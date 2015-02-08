var config     = require('../config/import.config');
var log        = require('../lib/log')('ledgerstream');
var Importer   = require('./importer');
var live       = new Importer();
var indexer;
var couchdb;
var couchdbValidator;
var aggregator;
var postgres;
var postgresValidator;
var HBase;
var hbase;

var typeList = config.get('type') || 'postgres';
var types    = { };
typeList = typeList.split(',');
typeList.forEach(function(type) {
  types[type] = true;
});

//start import stream
live.liveStream();


//hbase importer
if (types.hbase) {
  log.info('Saving Ledgers to HBase');
  HBase = require('./hbase/client');
  hbase = new HBase();

    //ensure we have the proper tables before importing
    //hbase._initTables();
    
  live.on('ledger', function(ledger) {
    hbase.saveLedger(ledger, function(err, resp) {
    });
  });
}


//postgres importer
if (types.postgres) {
  log.info('Saving Ledgers to Postgres');
  postgres = new require('./postgres/client');
  postgresValidator = new require('./postgres/validate')();
  
  postgresValidator.start();
  live.on('ledger', function(ledger) {
    postgres.saveLedger(ledger, function(err, resp){
      if (err) {
        log.error('error saving ledger:', err);
      } else {
        log.info('Ledger Saved:', resp.ledger_index);
      }
    });
  });
}

//couchdb importer
if (types.couchdb) {
  log.info('Saving Ledgers to CouchDB');
  indexer = require('./couchdb/indexer');
  couchdb = require('./couchdb/client');
  couchdbValidator = new require('./couchdb/validate')();
  
  if (config.get('aggregate')) {
    aggregator = require('../lib/aggregator');
  }
  
  couchdbValidator.start();
  live.on('ledger', function(ledger) {
    //aggregator.digestLedger(ledger);
    //return;
    
    couchdb.saveLedger(ledger, function(err, resp){
      if (resp) indexer.pingCouchDB();
      if (config.get('aggregate')) {
        aggregator.digestLedger(ledger);
      }
    });
  });
}