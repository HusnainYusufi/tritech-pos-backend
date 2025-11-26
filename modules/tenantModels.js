const { Schema } = require('mongoose');

function getTenantModel(conn, name, schemaFactory, collectionName) {
  if (!conn) throw new Error('getTenantModel: connection required');
  if (conn.models[name]) return conn.models[name];
  const schema = schemaFactory(Schema);
  return conn.model(name, schema, collectionName); 
}

module.exports = { getTenantModel };
