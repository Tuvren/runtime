{ pkgs, ... }:
{
  languages.rust = {
    enable = true;
    toolchainFile = ./rust-toolchain.toml;
  };

  packages = [
    pkgs.bun
    pkgs.buf
    pkgs.nodejs_24
    pkgs.protobuf
    pkgs.protoc-gen-es
    pkgs.weaver
  ];
}
