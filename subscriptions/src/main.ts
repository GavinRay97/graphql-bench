import {
  argumentGenerator,
  GQL,
  SubscriptionBenchConfig,
  yamlConfigToSocketManagerParams,
  COLORS,
} from './utils'
import WebSocket from 'ws'
import WebSocketAsPromised from 'websocket-as-promised'
import { Events, knexConnection } from './schema'
import logUpdate from 'log-update'

const DEBUG = process.env.DEBUG

let GLOBAL_DATA_EVENT_COUNT = 0
let GLOBAL_ERROR_EVENT_COUNT = 0
let GLOBAL_SOCKET_COUNT = 0

/**
 * =================
 * Program Contents
 * =================
 *  - SocketManager:
 *     Holds config for the benchmark parameters and controls spawning/orchestrating Socket connections.
 *     Also performs DB insert at the end.
 *
 * - Connection:
 *    An individual Websocket, maintains an internal record of received events.
 *    Message handlers are registered here, these push to events.
 *
 * - main():
 *    Reads from config file, instantiates a SocketManager based on params in file.
 *    Spawns more sockets at configured number per second until target reached.
 *    Listens for ctrl + c to kill, which invokes exit()
 *
 * - exit():
 *    Teardown handler. Awaits closing all socket connections, writing data to DB, and destroying DB connection.
 */

/**
 * =====================
 * SOCKET MANAGER CLASS
 * =====================
 */

export interface SockerManagerConfig {
  label: string
  endpoint: string
  variables: object
  headers?: Record<string, string>
  maxConnections: number
  insertPayloadData: boolean
  connectionsPerSecond: number
  pgConnectionString: string
  subscriptionString: string
}

class SocketManager {
  private nextSocketId = 1
  public connections: { [id: number]: Connection } = {}
  public config: SockerManagerConfig
  public queryArgGenerator: Iterator<any>

  constructor(config: SockerManagerConfig) {
    this.config = config
    this.queryArgGenerator = argumentGenerator(config.variables)
  }

  public closeSockets() {
    return Promise.all(
      Object.values(this.connections).map((conn) => {
        conn.socket.sendPacked({ type: GQL.CONNECTION_TERMINATE })
        conn.socket.close()
      })
    )
  }

  public get allEvents() {
    return Object.values(this.connections).flatMap((conn) => conn.events)
  }

  public async insertEvents() {
    return Events.query()
      .allowInsert('[connection_id, event_number, event_data, event_time]')
      .insertGraph(this.allEvents)
  }

  private makeSocket() {
    const socketFactory = (url) =>
      new WebSocket(url, 'graphql-ws', { headers: this.config.headers })
    return new WebSocketAsPromised(this.config.endpoint, {
      createWebSocket: (url) => socketFactory(url),
      extractMessageData: (event) => event,
      packMessage: (data) => JSON.stringify(data),
      unpackMessage: (data) => JSON.parse(data as string),
    } as any)
  }
  public async spawnConnection() {
    const label = this.config.label
    const socket = this.makeSocket()
    const socketId = this.nextSocketId++
    const { insertPayloadData } = this.config
    try {
      await socket.open()
      socket.sendPacked({
        type: GQL.CONNECTION_INIT,
        payload: this.config.headers,
      })
      socket.sendPacked({
        id: String(socketId),
        type: GQL.START,
        payload: {
          query: this.config.subscriptionString,
          variables: this.queryArgGenerator.next().value,
        },
      })
      const connection = new Connection({
        id: socketId,
        label,
        socket,
        insertPayloadData,
      })
      this.connections[socketId] = connection
      return connection
    } catch (err) {
      console.log('Caught error when calling spawnConnection()', err)
      throw err
    }
  }
}

/**
 * =======================
 * SOCKET CONNECTION CLASS
 * =======================
 */

export type FormatedError = Error & {
  originalError?: any
}

interface ConnectionParams {
  id: number
  label: string
  socket: WebSocketAsPromised
  insertPayloadData: boolean
}

class Connection implements ConnectionParams {
  public id: number
  public eventNumber = 1
  public label: string
  public events: Array<any> = []
  public socket: WebSocketAsPromised
  public insertPayloadData: boolean

  constructor({ id, socket, label, insertPayloadData }: ConnectionParams) {
    this.id = id
    this.socket = socket
    this.label = label
    this.insertPayloadData = insertPayloadData
    this.configureMessageHandlers()
    if (DEBUG) {
      socket.onSend.addListener((data) => console.log('sent', data))
    }
  }

  private makeEventRow({ payload, err }) {
    return {
      is_error: err,
      operation_id: 1,
      connection_id: this.id,
      label: this.label,
      event_number: this.eventNumber++,
      event_data: this.insertPayloadData ? payload : { data: null },
      event_time: new Date().toISOString(),
    }
  }

  private configureMessageHandlers() {
    this.socket.onUnpackedMessage.addListener((data) => {
      switch (data.type) {
        case GQL.DATA:
          const event = this.makeEventRow({ payload: data.payload, err: false })
          if (DEBUG) console.log('CALLED GQL.DATA CASE, GOT EVENT ROW', event)
          GLOBAL_DATA_EVENT_COUNT++
          this.events.push(event)
          break
        case GQL.ERROR:
          const error = this.makeEventRow({ payload: data.payload, err: true })
          if (DEBUG) console.log('CALLED GQL.ERROR CASE, GOT ERROR ROW', error)
          GLOBAL_ERROR_EVENT_COUNT++
          this.events.push(error)
          break
      }
      updateEventStatsStdout()
    })
  }
}

/**
 * =====================
 *     UTILS & MISC
 * =====================
 */

async function assertDatabaseConnection() {
  return knexConnection.raw('select 1+1 as result').catch((err: any) => {
    console.log('Failed to establish connection to database! Exiting...')
    console.log(err)
    process.exit(1)
  })
}

function updateEventStatsStdout() {
  logUpdate(
    COLORS.FG_CYAN +
      `Socket count: ${GLOBAL_SOCKET_COUNT} | ` +
      COLORS.RESET +
      COLORS.FG_GREEN +
      `Data Events Received: ${GLOBAL_DATA_EVENT_COUNT} | ` +
      COLORS.RESET +
      COLORS.FG_RED +
      `Error Events Received: ${GLOBAL_ERROR_EVENT_COUNT} ` +
      COLORS.RESET
  )
}

function prettyPrintConfig(options) {
  console.table({
    url: options.url,
    db_connection_string: options.db_connection_string,
  })
  console.table({ headers: options.headers })
  console.table({ config: options.config }, [
    'label',
    'max_connections',
    'connections_per_second',
  ])
  console.table({ variables: options.config.variables })
}

/**
 * =====================
 *   MAIN PROGRAM CODE
 * =====================
 */

async function main() {
  const options: SubscriptionBenchConfig = require('./utils').config

  /**
   * Logging
   */

  const database =
    process.env.PG_CONNECTION_STRING || options.db_connection_string
  console.log('Asserting database connectivity, trying to conect to:')
  console.log(COLORS.FG_CYAN, database, COLORS.RESET)

  await assertDatabaseConnection()
  prettyPrintConfig(options)

  console.log(
    'Connected, starting subscriptions benchmark for a total of',
    options.config.max_connections,
    'sockets at a connection rate of',
    options.config.connections_per_second,
    'sockets per second'
  )

  /**
   * Execution
   */

  const socketManagerParams = yamlConfigToSocketManagerParams(options)
  const socketManager = new SocketManager(socketManagerParams)

  const MAX_CONNECTIONS = options.config.max_connections
  const SPAWN_RATE = 1000 / options.config.connections_per_second

  // Need two counters to prevent more sockets being spawned than config set
  let socketSpawned = 0
  const spawnFn = () => {
    socketSpawned++
    return socketManager.spawnConnection().then((socket) => {
      GLOBAL_SOCKET_COUNT++
      if (socketSpawned >= MAX_CONNECTIONS) clearInterval(spawnInterval)
    })
  }

  const spawnInterval = setInterval(spawnFn, SPAWN_RATE)
  process.on('SIGINT', () => exit(socketManager))
}

/**
 * =====================
 * EXIT TEARDOWN PROCESS
 * =====================
 */

async function exit(socketManager: SocketManager) {
  console.log('\nExecuting Teardown Process')
  try {
    console.log('Starting to close socket connections')
    await socketManager.closeSockets()
  } catch (error) {
    console.log('Error while closing socket connections:', error)
  }

  try {
    console.log('Sockets closed, attempting to insert event data')
    const events = await socketManager.insertEvents()
    console.log(
      `Inserted total of ${events.length} events for label ${socketManager.config.label}`
    )
  } catch (error) {
    console.log('Error while inserting events:', error)
  }

  try {
    console.log('Trying to close DB connection pool')
    await knexConnection.destroy()
    console.log('Database connection destroyed')
  } catch (error) {
    console.log('Error while destroying database connection:', error)
  }

  console.log('Now exiting the process')
  process.exit(1)
}

/**
 * =====================
 *  INVOKE APPLICATION
 * =====================
 */

main()
