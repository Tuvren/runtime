fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Cargo owns Rust codegen for Epic U; Buf remains the lint/breaking
    // authority for the checked-in proto surface.
    let proto_root = "../../../interop/grpc/proto";
    let proto_files = [
        format!("{proto_root}/tuvren/kernel/interop/v1/kernel_types.proto"),
        format!("{proto_root}/tuvren/kernel/interop/v1/kernel_services.proto"),
    ];
    let include_roots = [proto_root.to_string()];
    tonic_prost_build::configure().compile_protos(&proto_files, &include_roots)?;
    Ok(())
}
