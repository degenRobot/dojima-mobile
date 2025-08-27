#!/usr/bin/env node

/**
 * Script to automatically update ABIs after contract deployment
 * Extracts ABIs from Foundry artifacts and updates mobile app configurations
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const MOBILE_DIR = path.join(__dirname, '../mobile');
const ARTIFACTS_DIR = path.join(CONTRACTS_DIR, 'out');
const MOBILE_ABIS_DIR = path.join(MOBILE_DIR, 'src/config/abis');

// Contract names to track
const CONTRACTS_TO_UPDATE = [
    'UnifiedCLOBV2',
    'MintableERC20'
];

function extractABI(contractName) {
    const artifactPath = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
    
    if (!fs.existsSync(artifactPath)) {
        console.warn(`Warning: Artifact not found for ${contractName} at ${artifactPath}`);
        return null;
    }
    
    try {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        return artifact.abi;
    } catch (error) {
        console.error(`Error reading artifact for ${contractName}:`, error);
        return null;
    }
}

function updateMobileABIs() {
    console.log('🔄 Updating Mobile App ABIs...\n');
    
    // Ensure ABI directory exists
    if (!fs.existsSync(MOBILE_ABIS_DIR)) {
        fs.mkdirSync(MOBILE_ABIS_DIR, { recursive: true });
    }
    
    const updatedContracts = [];
    
    for (const contractName of CONTRACTS_TO_UPDATE) {
        const abi = extractABI(contractName);
        
        if (abi) {
            // Write individual ABI file
            const abiPath = path.join(MOBILE_ABIS_DIR, `${contractName}.json`);
            fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
            console.log(`✅ Updated ABI for ${contractName}`);
            updatedContracts.push(contractName);
        }
    }
    
    // Create index file for easy imports
    const indexContent = updatedContracts.map(name => 
        `export { default as ${name}ABI } from './${name}.json';`
    ).join('\n');
    
    const indexPath = path.join(MOBILE_ABIS_DIR, 'index.ts');
    fs.writeFileSync(indexPath, indexContent + '\n');
    console.log('\n✅ Created index file for ABIs');
    
    // Update contracts.ts if needed
    updateContractsFile(updatedContracts);
}

function updateContractsFile(updatedContracts) {
    const contractsPath = path.join(MOBILE_DIR, 'src/config/contracts.ts');
    
    if (!fs.existsSync(contractsPath)) {
        console.log('\n⚠️  contracts.ts not found, skipping update');
        return;
    }
    
    let contractsContent = fs.readFileSync(contractsPath, 'utf8');
    
    // Check if we need to add imports
    const importStatements = updatedContracts
        .filter(name => !contractsContent.includes(`${name}ABI`))
        .map(name => `import { ${name}ABI } from './abis';`);
    
    if (importStatements.length > 0) {
        // Add imports after the first import line
        const firstImportIndex = contractsContent.indexOf('import ');
        const firstImportEndIndex = contractsContent.indexOf('\n', firstImportIndex);
        
        contractsContent = 
            contractsContent.slice(0, firstImportEndIndex + 1) +
            importStatements.join('\n') + '\n' +
            contractsContent.slice(firstImportEndIndex + 1);
        
        fs.writeFileSync(contractsPath, contractsContent);
        console.log('\n✅ Updated imports in contracts.ts');
    }
}

function checkForDeployment() {
    // Check if there are recent broadcast files
    const broadcastDir = path.join(CONTRACTS_DIR, 'broadcast');
    
    if (!fs.existsSync(broadcastDir)) {
        console.log('\n⚠️  No broadcast directory found. Deploy contracts first.');
        return false;
    }
    
    // Find the most recent deployment
    const deployments = [];
    
    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                walkDir(filePath);
            } else if (file.endsWith('.json') && file.includes('run-')) {
                deployments.push({
                    path: filePath,
                    mtime: stat.mtime
                });
            }
        }
    }
    
    walkDir(broadcastDir);
    
    if (deployments.length > 0) {
        deployments.sort((a, b) => b.mtime - a.mtime);
        const latest = deployments[0];
        console.log(`\n📋 Latest deployment found: ${new Date(latest.mtime).toLocaleString()}`);
        
        // Extract addresses from the latest deployment
        try {
            const deployment = JSON.parse(fs.readFileSync(latest.path, 'utf8'));
            console.log('\nDeployed contracts:');
            
            if (deployment.transactions) {
                deployment.transactions
                    .filter(tx => tx.contractName && tx.contractAddress)
                    .forEach(tx => {
                        console.log(`  ${tx.contractName}: ${tx.contractAddress}`);
                    });
            }
        } catch (error) {
            console.error('Error reading deployment:', error);
        }
        
        return true;
    }
    
    console.log('\n⚠️  No deployments found in broadcast directory.');
    return false;
}

// Main execution
function main() {
    console.log('🚀 ABI Update Script\n');
    console.log('=====================================\n');
    
    // Check if contracts are built
    if (!fs.existsSync(ARTIFACTS_DIR)) {
        console.error('❌ Contracts not built. Run "forge build" first.');
        process.exit(1);
    }
    
    // Update ABIs
    updateMobileABIs();
    
    // Check for recent deployments
    checkForDeployment();
    
    console.log('\n=====================================');
    console.log('\n✨ ABI update completed successfully!\n');
    
    console.log('Next steps:');
    console.log('  1. Deploy contracts: npm run deploy-and-sync');
    console.log('  2. Update contract addresses in mobile/src/config/contracts.ts');
    console.log('  3. Test mobile app integration\n');
}

// Run the script
main();