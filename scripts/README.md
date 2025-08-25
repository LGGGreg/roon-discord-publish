# Build and Utility Scripts

This directory contains build scripts and utilities for the Roon Discord Rich Presence application.

## Scripts

### **`setup-local-node.js`**
Sets up a local Node.js installation for the application.

**Usage:**
```bash
npm run setup-node
# or
node scripts/setup-local-node.js
```

**Purpose:**
- Downloads and installs a specific Node.js version locally
- Ensures consistent Node.js version across different environments
- Required for building standalone executables

### **`create-distribution.js`**
Creates distribution packages for the application.

**Usage:**
```bash
npm run create-dist
# or
node scripts/create-distribution.js
```

**Purpose:**
- Packages the application for distribution
- Creates platform-specific builds
- Handles file organization and cleanup

### **`add-icon.js`**
Adds application icons to executables.

**Usage:**
```bash
npm run add-icon
# or
node scripts/add-icon.js
```

**Purpose:**
- Embeds application icons into executable files
- Ensures proper branding for distributed applications
- Platform-specific icon handling

## Build Process

The typical build process uses these scripts in sequence:

1. **Setup Local Node.js**
   ```bash
   npm run setup-node
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Create Distribution**
   ```bash
   npm run create-dist
   ```

## Development vs Production

- **Development**: Scripts may include additional debugging and verbose output
- **Production**: Scripts optimize for size and performance

## Platform Support

These scripts support:
- ✅ Windows (primary)
- ✅ macOS
- ✅ Linux

## Dependencies

Scripts may require:
- Node.js (specific version managed by setup-local-node.js)
- Platform-specific build tools
- Internet connection (for downloading dependencies)

## Troubleshooting

### Common Issues

1. **Permission Errors**: Run with appropriate permissions (admin/sudo if needed)
2. **Network Issues**: Ensure internet connection for downloads
3. **Path Issues**: Verify Node.js and npm are in PATH

### Debug Mode

Most scripts support verbose output:
```bash
NODE_ENV=development node scripts/script-name.js
```
