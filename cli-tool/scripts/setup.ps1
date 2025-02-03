# Build and link shared package
Set-Location -Path "../../shared"
npm install
npm run build
npm link

# Build CLI tool
Set-Location -Path "../cli-tool"
npm install
npm link "@test-filestructure-linter/shared"
npm run build 