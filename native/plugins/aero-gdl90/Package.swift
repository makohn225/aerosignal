// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AeroGdl90",
    platforms: [.iOS(.v14)],
    products: [.library(name: "AeroGdl90", targets: ["AeroGdl90Plugin"])],
    dependencies: [.package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "7.0.0")],
    targets: [
        .target(
            name: "AeroGdl90Plugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/AeroGdl90Plugin")
    ]
)
