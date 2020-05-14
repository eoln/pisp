#!/usr/bin/env node

/**
 * @function printUsage
 * @description - Prints the usage of this script
 */
function printUsage() {
  console.warn('Usage: ./wait-for.js --service=[central-ledger | ]')
}

/**
 * @function wrapWithRetries
 * @description - Call the given function with a number of retries.
 * @param {fn} func - Async function to call with retries
 * @param {number} retries - Number of times to retry before returning an error if the func fails
 * @param {number} waitTimeMs - Ms time to wait before trying again
 */
async function wrapWithRetries(func, retries, waitTimeMs) {
  // console.error('trying func with retries:', func, retries)
  try {
    const result = await func()
    return result
  } catch (err) {
    if (retries > 0) {
      return new Promise((resolve, reject) => {
        setTimeout(() => resolve(wrapWithRetries(func, retries -1, waitTimeMs)), waitTimeMs)
      })
    }

    console.error('Out of retries for func: ', func)
    throw err
  }
}

async function waitForMySQL() {
  const projectDir = process.env.WAIT_FOR_PROJECT_DIR
  const RC = require(projectDir + '/node_modules/rc')('CLEDG', require(`${projectDir}/config/default.json`))

  const knex = require(projectDir + '/node_modules/knex')({
    client: RC.DATABASE.DIALECT,
    connection: {
      host: RC.DATABASE.HOST.replace(/\/$/, ''),
      port: RC.DATABASE.PORT,
      user: RC.DATABASE.USER,
      password: RC.DATABASE.PASSWORD,
      database: RC.DATABASE.SCHEMA
    }
  });

  await knex.select(1)
  return 'MySQL Connected';
}

async function waitForKafka() {
  // throw new Error('Could not connect to MySQL')
  return 'Kafka Connected';
}

async function waitForObjectstore() {
  // throw new Error('Could not connect to Objectstore')
  return 'Objecstore Connected';
}

/**
 * waitForFunctions
 * Define the set of functions to wait for before a given service starts up
 */
const waitForFunctions = {
  'central-ledger': [
    waitForMySQL,
    // waitForKafka,
    // waitForObjectstore
  ],
  // Add your service here
}

async function main() {
  console.log("process.env is", process.env)
  console.log('args are', process.argv)

  const serviceName = process.env.WAIT_FOR_SERVICE_NAME;
  const projectDir = process.env.WAIT_FOR_PROJECT_DIR;

  // TODO: error if the above 2 are not set
  // TODO: check for node_modules


  const internalServiceRetries = parseInt(process.env.WAIT_FOR_RETRIES || 5)
  const retryWaitMs = parseInt(process.env.WAIT_FOR_RETRY_MS || 1000)

  //Get the list of functions to run
  const functionList = waitForFunctions[serviceName]

  if (!functionList || functionList.length === 0) {
    console.error(`Found no functions for service: ${serviceName}.`);
    printUsage();
    process.exit(1);
  }

  const waitForErrors = [];
  const result = await Promise.all(functionList.map(async func => {
    return wrapWithRetries(func, internalServiceRetries, retryWaitMs)
    .then(result => result)
    .catch(err => waitForErrors.push(err))
  }))

  if (waitForErrors.length > 0) {
    console.error(`wait-for failed with the following errors:`)
    console.error(waitForErrors)
    process.exit(1);
  }


  // const result = await functionList.reduce(async (acc, curr, idx) => {
  //   await acc;

  //   return wrapWithRetries(curr, 5, 10)
  // }, Promise.resolve(true))

  console.log("wait-for result is", result)
  process.exit(0)
}

main()