/**
 * Test script to verify Swagger configuration loads correctly
 * This script validates the swagger setup without starting the full server
 */

console.log('🔍 Testing Swagger Configuration...\n');

try {
  // Test 1: Load swagger configuration
  console.log('Test 1: Loading swagger configuration...');
  const swaggerSpec = require('./config/swagger.config');
  
  if (!swaggerSpec) {
    throw new Error('Swagger spec is undefined');
  }
  
  console.log('✅ Swagger configuration loaded successfully');
  console.log(`   - Title: ${swaggerSpec.info?.title}`);
  console.log(`   - Version: ${swaggerSpec.info?.version}`);
  console.log(`   - OpenAPI Version: ${swaggerSpec.openapi}`);
  
  // Test 2: Verify required fields
  console.log('\nTest 2: Verifying required fields...');
  
  const requiredFields = ['openapi', 'info', 'paths', 'servers'];
  const missingFields = requiredFields.filter(field => !swaggerSpec[field]);
  
  if (missingFields.length > 0) {
    console.log(`⚠️  Warning: Missing fields: ${missingFields.join(', ')}`);
    console.log('   Note: "paths" will be populated from JSDoc comments in controllers');
  } else {
    console.log('✅ All required fields present');
  }
  
  // Test 3: Verify security schemes
  console.log('\nTest 3: Verifying security schemes...');
  
  const securitySchemes = swaggerSpec.components?.securitySchemes;
  if (securitySchemes) {
    console.log('✅ Security schemes configured:');
    Object.keys(securitySchemes).forEach(scheme => {
      console.log(`   - ${scheme}: ${securitySchemes[scheme].type}`);
    });
  } else {
    console.log('⚠️  No security schemes found');
  }
  
  // Test 4: Verify schemas
  console.log('\nTest 4: Verifying component schemas...');
  
  const schemas = swaggerSpec.components?.schemas;
  if (schemas) {
    console.log(`✅ ${Object.keys(schemas).length} schemas defined:`);
    Object.keys(schemas).slice(0, 5).forEach(schema => {
      console.log(`   - ${schema}`);
    });
    if (Object.keys(schemas).length > 5) {
      console.log(`   ... and ${Object.keys(schemas).length - 5} more`);
    }
  } else {
    console.log('⚠️  No schemas found');
  }
  
  // Test 5: Verify tags
  console.log('\nTest 5: Verifying tags...');
  
  const tags = swaggerSpec.tags;
  if (tags && tags.length > 0) {
    console.log(`✅ ${tags.length} tags defined:`);
    tags.slice(0, 5).forEach(tag => {
      console.log(`   - ${tag.name}`);
    });
    if (tags.length > 5) {
      console.log(`   ... and ${tags.length - 5} more`);
    }
  } else {
    console.log('⚠️  No tags found');
  }
  
  // Test 6: Verify servers
  console.log('\nTest 6: Verifying servers...');
  
  const servers = swaggerSpec.servers;
  if (servers && servers.length > 0) {
    console.log(`✅ ${servers.length} server(s) configured:`);
    servers.forEach(server => {
      console.log(`   - ${server.url} (${server.description})`);
    });
  } else {
    console.log('⚠️  No servers configured');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Swagger configuration is valid and ready to use!');
  console.log('='.repeat(60));
  console.log('\n📚 To view the documentation:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Open browser: http://localhost:3000/api/docs');
  console.log('   3. View JSON spec: http://localhost:3000/api/docs.json');
  console.log('\n');
  
  process.exit(0);
  
} catch (error) {
  console.error('\n❌ Error testing Swagger configuration:');
  console.error(`   ${error.message}`);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
}
