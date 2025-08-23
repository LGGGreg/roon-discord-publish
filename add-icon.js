const ResEdit = require('resedit');
const fs = require('fs');

const exePath = 'Roon Discord Rich Presence.exe';
const iconPath = 'assets/icon.ico';

console.log('🎨 Adding icon to executable using resedit...');

try {
    // Read the executable
    const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
    const res = ResEdit.NtExecutableResource.from(exe);

    // Read the icon file
    const iconFile = fs.readFileSync(iconPath);
    const iconData = ResEdit.Data.IconFile.from(iconFile);

    // Replace the icon (using icon group ID 1, language 1033 = English US)
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1, // Icon group ID
        1033, // Language ID (English US)
        iconData.icons.map((item) => item.data)
    );

    // Write the modified executable
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));

    console.log('✅ Icon successfully added to executable!');
} catch (error) {
    console.error('❌ Error adding icon:', error.message);
    process.exit(1);
}
