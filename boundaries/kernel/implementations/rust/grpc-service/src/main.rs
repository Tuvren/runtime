use std::net::SocketAddr;

use tuvren_kernel_rust::InMemoryKernel;
use tuvren_kernel_rust_grpc_service::serve_kernel_grpc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Keep the baseline runnable without inventing a configuration contract;
    // the formal TS transport client and runtime switch arrive in Epic V.
    let address = std::env::var("TUVREN_KERNEL_GRPC_ADDR")
        .unwrap_or_else(|_| "127.0.0.1:50051".to_string())
        .parse::<SocketAddr>()?;

    serve_kernel_grpc(address, InMemoryKernel::new()).await?;
    Ok(())
}
