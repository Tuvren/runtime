/**
 * Copyright 2026 Oscar Yáñez Cisterna (@SkrOYC)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {
  Binding,
  CapabilityPolicyContext,
  CapabilityPolicyEngine,
  ExecutionClass,
  ExposureDecision,
  InvocationDecision,
  ToolSurface,
} from "@tuvren/core/capabilities";

// ---------------------------------------------------------------------------
// PolicyDimension — extension interface (BB005)
// ---------------------------------------------------------------------------

type DenyExposure = {
  exposed: false;
  reason: string;
  surfaceName: string;
};

type DenyInvocation = {
  admitted: false;
  capabilityId: string;
  executionClass: ExecutionClass;
  reason: string;
  requiresApproval?: boolean;
};

/**
 * A single policy dimension evaluated at both decision points. Framework
 * dimensions run first in declared order; extension dimensions run after.
 * A deny from any dimension is honored and stops evaluation for that surface
 * or binding.
 */
export interface PolicyDimension {
  checkExposure(
    surface: ToolSurface,
    context: CapabilityPolicyContext
  ): DenyExposure | null;
  checkInvocation(
    binding: Binding,
    context: CapabilityPolicyContext
  ): DenyInvocation | null;
}

// ---------------------------------------------------------------------------
// CapabilityPolicyEngineOptions
// ---------------------------------------------------------------------------

/**
 * Configuration for the Capability Policy Engine.
 *
 * All fields are optional. When a field is absent its corresponding policy
 * dimension is not active. The engine applies only the dimensions for which
 * configuration was supplied or defaults are meaningful.
 */
export interface CapabilityPolicyEngineOptions {
  // --- Baseline deny-list (Epic AW) ---
  /** Capability ids to deny at invocation-time regardless of other context. */
  deniedCapabilityIds?: Set<string>;
  /** Surface names to deny at exposure-time regardless of other context. */
  deniedSurfaceNames?: Set<string>;

  // --- BB001: Data-residency ---
  /**
   * Allowed data-residency regions at engine level. When set and non-empty,
   * surfaces and bindings whose endpoint region is not in this set are
   * withheld or denied. Combined with context.allowedRegions via intersection.
   */
  allowedRegions?: Set<string>;
  /**
   * When true, surfaces and bindings without a region tag are treated as
   * compliant. Default false: missing region is non-compliant when
   * allowedRegions is configured.
   */
  allowMissingRegion?: boolean;

  // --- BB002: Risk-classification ---
  /**
   * Maximum risk class the engine permits globally. Surfaces and bindings
   * with riskClass exceeding this are withheld or denied.
   */
  maxAllowedRiskClass?: "low" | "medium" | "high";
  /**
   * When true, high-risk capabilities in compatible contexts produce
   * admitted:false with requiresApproval:true rather than a hard denial.
   */
  highRiskRequiresApproval?: boolean;

  // --- BB004: Credential-boundary ---
  /**
   * When true, the engine checks binding.credentialScope against
   * context.entitledCredentialScopes. Default false.
   */
  enforceCredentialBoundary?: boolean;

  // --- BB005: Extension dimensions ---
  /**
   * Extension-contributed policy dimensions. Composed after all framework
   * dimensions in declared order. Cannot override a prior framework denial.
   */
  dimensions?: PolicyDimension[];
}

// ---------------------------------------------------------------------------
// Risk rank helper
// ---------------------------------------------------------------------------

const RISK_RANK: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function riskRank(cls: "low" | "medium" | "high" | undefined): number {
  return cls === undefined ? -1 : RISK_RANK[cls];
}

// ---------------------------------------------------------------------------
// Built-in dimension implementations
// ---------------------------------------------------------------------------

class ResidencyDimension implements PolicyDimension {
  constructor(
    private readonly allowed: ReadonlySet<string> | undefined,
    private readonly allowMissing: boolean
  ) {}

  private isAllowed(
    region: string | undefined,
    contextAllowed: string[] | undefined
  ): boolean {
    // No policy configured anywhere → pass
    if (
      (this.allowed === undefined || this.allowed.size === 0) &&
      (contextAllowed === undefined || contextAllowed.length === 0)
    ) {
      return true;
    }

    if (region === undefined) {
      return this.allowMissing;
    }

    // If engine-level allowedRegions is set, check it
    if (this.allowed !== undefined && this.allowed.size > 0) {
      if (!this.allowed.has(region)) return false;
    }

    // If context narrows further, check it
    if (contextAllowed !== undefined && contextAllowed.length > 0) {
      if (!contextAllowed.includes(region)) return false;
    }

    return true;
  }

  checkExposure(surface: ToolSurface, context: CapabilityPolicyContext): DenyExposure | null {
    if (this.isAllowed(surface.endpointRegion, context.allowedRegions)) {
      return null;
    }
    return {
      exposed: false,
      reason: "data-residency policy: endpoint region not in allowed set",
      surfaceName: surface.name,
    };
  }

  checkInvocation(binding: Binding, context: CapabilityPolicyContext): DenyInvocation | null {
    if (this.isAllowed(binding.endpoint.region, context.allowedRegions)) {
      return null;
    }
    return {
      admitted: false,
      capabilityId: binding.capabilityId,
      executionClass: binding.executionClass,
      reason: "data-residency policy: endpoint region not in allowed set",
    };
  }
}

class RiskDimension implements PolicyDimension {
  constructor(
    private readonly maxRiskClass: "low" | "medium" | "high" | undefined,
    private readonly highRiskRequiresApproval: boolean
  ) {}

  private effectiveMax(context: CapabilityPolicyContext): number {
    const engineMax =
      this.maxRiskClass !== undefined ? RISK_RANK[this.maxRiskClass] : 2;
    const contextMax =
      context.maxAllowedRiskClass !== undefined
        ? RISK_RANK[context.maxAllowedRiskClass]
        : 2;
    return Math.min(engineMax, contextMax);
  }

  checkExposure(surface: ToolSurface, context: CapabilityPolicyContext): DenyExposure | null {
    if (surface.riskClass === undefined) return null;
    const max = this.effectiveMax(context);
    if (max === 2) return null; // all risk classes permitted
    if (riskRank(surface.riskClass) > max) {
      return {
        exposed: false,
        reason: "risk-classification policy: capability risk class exceeds permitted level",
        surfaceName: surface.name,
      };
    }
    return null;
  }

  checkInvocation(binding: Binding, context: CapabilityPolicyContext): DenyInvocation | null {
    if (binding.riskClass === undefined) return null;
    const max = this.effectiveMax(context);

    if (max < 2 && riskRank(binding.riskClass) > max) {
      return {
        admitted: false,
        capabilityId: binding.capabilityId,
        executionClass: binding.executionClass,
        reason: "risk-classification policy: capability risk class exceeds permitted level",
      };
    }

    // High-risk requires approval when configured (soft gate)
    if (
      this.highRiskRequiresApproval &&
      binding.riskClass === "high" &&
      riskRank(binding.riskClass) <= max
    ) {
      return {
        admitted: false,
        capabilityId: binding.capabilityId,
        executionClass: binding.executionClass,
        reason: "risk-classification policy: high-risk capability requires approval",
        requiresApproval: true,
      };
    }

    return null;
  }
}

class PresenceDimension implements PolicyDimension {
  checkExposure(surface: ToolSurface, context: CapabilityPolicyContext): DenyExposure | null {
    if (
      surface.requiresActiveEndpoint === true &&
      context.endpointAttached === false
    ) {
      return {
        exposed: false,
        reason: "presence policy: capability requires an active endpoint",
        surfaceName: surface.name,
      };
    }
    return null;
  }

  checkInvocation(binding: Binding, context: CapabilityPolicyContext): DenyInvocation | null {
    if (
      binding.requiresUserPresence === true &&
      context.userPresent === false
    ) {
      return {
        admitted: false,
        capabilityId: binding.capabilityId,
        executionClass: binding.executionClass,
        reason: "presence policy: capability requires active user presence",
      };
    }
    return null;
  }
}

class CredentialBoundaryDimension implements PolicyDimension {
  constructor(private readonly enforce: boolean) {}

  checkExposure(_surface: ToolSurface, _context: CapabilityPolicyContext): DenyExposure | null {
    return null; // credential boundary is an invocation-time gate
  }

  checkInvocation(binding: Binding, context: CapabilityPolicyContext): DenyInvocation | null {
    if (!this.enforce) return null;
    const scope = binding.credentialScope ?? binding.endpoint.credentialScope;
    if (scope === undefined) return null;

    const entitled = context.entitledCredentialScopes;
    if (entitled === undefined || !entitled.includes(scope)) {
      return {
        admitted: false,
        capabilityId: binding.capabilityId,
        executionClass: binding.executionClass,
        reason: "credential-boundary policy: execution edge not entitled to required credential scope",
      };
    }
    return null;
  }
}

class DenyListDimension implements PolicyDimension {
  constructor(
    private readonly deniedCapabilities: ReadonlySet<string>,
    private readonly deniedSurfaces: ReadonlySet<string>
  ) {}

  checkExposure(surface: ToolSurface, _context: CapabilityPolicyContext): DenyExposure | null {
    if (!this.deniedSurfaces.has(surface.name)) return null;
    return {
      exposed: false,
      reason: "surface denied by exposure-time policy",
      surfaceName: surface.name,
    };
  }

  checkInvocation(binding: Binding, _context: CapabilityPolicyContext): DenyInvocation | null {
    if (!this.deniedCapabilities.has(binding.capabilityId)) return null;
    return {
      admitted: false,
      capabilityId: binding.capabilityId,
      executionClass: binding.executionClass,
      reason: "capability denied by invocation-time policy",
    };
  }
}

// ---------------------------------------------------------------------------
// Engine implementation
// ---------------------------------------------------------------------------

class CapabilityPolicyEngineImpl implements CapabilityPolicyEngine {
  private readonly frameworkDimensions: ReadonlyArray<PolicyDimension>;
  private readonly extensionDimensions: ReadonlyArray<PolicyDimension>;

  constructor(options: CapabilityPolicyEngineOptions) {
    this.frameworkDimensions = [
      new ResidencyDimension(
        options.allowedRegions,
        options.allowMissingRegion ?? false
      ),
      new RiskDimension(
        options.maxAllowedRiskClass,
        options.highRiskRequiresApproval ?? false
      ),
      new PresenceDimension(),
      new CredentialBoundaryDimension(
        options.enforceCredentialBoundary ?? false
      ),
      new DenyListDimension(
        options.deniedCapabilityIds ?? new Set(),
        options.deniedSurfaceNames ?? new Set()
      ),
    ];
    this.extensionDimensions = options.dimensions ?? [];
  }

  evaluateExposure(
    surfaces: ToolSurface[],
    context: CapabilityPolicyContext
  ): ExposureDecision[] {
    const allDimensions = [...this.frameworkDimensions, ...this.extensionDimensions];
    return surfaces.map((surface) => {
      for (const dim of allDimensions) {
        const denial = dim.checkExposure(surface, context);
        if (denial !== null) return denial;
      }
      return { exposed: true, surfaceName: surface.name };
    });
  }

  evaluateInvocation(
    binding: Binding,
    context: CapabilityPolicyContext
  ): InvocationDecision {
    // Collect idempotency annotation before the gate loop (never denies)
    const policyCanRetry =
      binding.idempotencyPolicy === "idempotent"
        ? true
        : binding.idempotencyPolicy === "non-idempotent"
          ? false
          : undefined;

    const allDimensions = [...this.frameworkDimensions, ...this.extensionDimensions];
    for (const dim of allDimensions) {
      const denial = dim.checkInvocation(binding, context);
      if (denial !== null) return denial;
    }

    return {
      admitted: true,
      capabilityId: binding.capabilityId,
      executionClass: binding.executionClass,
      ...(policyCanRetry !== undefined ? { policyCanRetry } : {}),
    };
  }
}

export function createCapabilityPolicyEngine(
  options: CapabilityPolicyEngineOptions = {}
): CapabilityPolicyEngine {
  return new CapabilityPolicyEngineImpl(options);
}
