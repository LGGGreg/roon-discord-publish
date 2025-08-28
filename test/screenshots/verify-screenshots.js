const fs = require('fs');
const path = require('path');

/**
 * Verify Screenshots Quality
 * Checks file sizes and creates a report of captured screenshots
 */
class ScreenshotVerifier {
    constructor() {
        this.baseDir = 'docs/screenshots';
    }

    getFileSize(filepath) {
        try {
            const stats = fs.statSync(filepath);
            return Math.round(stats.size / 1024); // Size in KB
        } catch (error) {
            return 0;
        }
    }

    verifyScreenshots() {
        console.log('🔍 Verifying Screenshots Quality...\n');
        
        const categories = ['features', 'setup', 'ui', 'integrations'];
        let totalScreenshots = 0;
        let goodScreenshots = 0;
        
        categories.forEach(category => {
            const categoryPath = path.join(this.baseDir, category);
            if (!fs.existsSync(categoryPath)) {
                console.log(`❌ Category directory missing: ${category}`);
                return;
            }
            
            const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.png'));
            console.log(`📁 ${category.toUpperCase()} (${files.length} files):`);
            
            files.forEach(file => {
                const filepath = path.join(categoryPath, file);
                const sizeKB = this.getFileSize(filepath);
                totalScreenshots++;
                
                // Consider screenshots good if they're over 50KB (likely has content)
                // and under 500KB (not too large)
                if (sizeKB > 50 && sizeKB < 500) {
                    console.log(`  ✅ ${file} - ${sizeKB}KB (Good)`);
                    goodScreenshots++;
                } else if (sizeKB < 10) {
                    console.log(`  ❌ ${file} - ${sizeKB}KB (Too small - likely blank)`);
                } else if (sizeKB > 500) {
                    console.log(`  ⚠️ ${file} - ${sizeKB}KB (Very large)`);
                    goodScreenshots++; // Still count as good
                } else {
                    console.log(`  ⚠️ ${file} - ${sizeKB}KB (Questionable)`);
                }
            });
            console.log('');
        });
        
        console.log('📊 SUMMARY:');
        console.log(`Total Screenshots: ${totalScreenshots}`);
        console.log(`Good Quality: ${goodScreenshots}`);
        console.log(`Success Rate: ${Math.round((goodScreenshots / totalScreenshots) * 100)}%`);
        
        if (goodScreenshots === totalScreenshots) {
            console.log('🎉 All screenshots appear to be good quality!');
        } else {
            console.log('⚠️ Some screenshots may need to be recaptured.');
        }
        
        return {
            total: totalScreenshots,
            good: goodScreenshots,
            successRate: Math.round((goodScreenshots / totalScreenshots) * 100)
        };
    }

    generateReport() {
        const verification = this.verifyScreenshots();
        
        const report = {
            timestamp: new Date().toISOString(),
            verification,
            screenshots: {}
        };
        
        // Catalog all screenshots
        const categories = ['features', 'setup', 'ui', 'integrations'];
        categories.forEach(category => {
            const categoryPath = path.join(this.baseDir, category);
            if (fs.existsSync(categoryPath)) {
                const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.png'));
                report.screenshots[category] = files.map(file => ({
                    filename: file,
                    sizeKB: this.getFileSize(path.join(categoryPath, file))
                }));
            }
        });
        
        // Save report
        const reportPath = path.join(this.baseDir, 'verification-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Verification report saved to: ${reportPath}`);
        
        return report;
    }
}

// Run verification
if (require.main === module) {
    const verifier = new ScreenshotVerifier();
    verifier.generateReport();
}

module.exports = ScreenshotVerifier;
