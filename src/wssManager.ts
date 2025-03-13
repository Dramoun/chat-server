import { WebSocket, WebSocketServer } from 'ws';
import { nanoid } from 'nanoid';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

import { UniqueSocketConnection, ChatMessage, HandShakeMessage, WSMessage } from './types/wssManager.types';


export class WSSManager{
  private readonly _wss: WebSocketServer;
  private _clientList: UniqueSocketConnection[] = [];

  constructor(
    private readonly port: number,
  ){
    this._wss = new WebSocketServer({ port: port});
    this._wss.on('listening', this._serverListening.bind(this));
    this._wss.on('connection', this._onConnection.bind(this));
    this._wss.on('close', this._onServerClose.bind(this));

    this._activeConnectionsCheck(1000);
  }

  private _serverListening(){
    console.log(`Server is listening on port ${this.port}`);
  }

  private _onServerClose(){
    console.log(`Server disconnected`);
  }

  private _onConnection(ws: WebSocket){
    ws.on('error', this._onClientError.bind(this));
    ws.on('message', this._onClientMessage.bind(this, ws));
  }

  private _onClientError(error: Error){
    console.error(`New error: ${error.message}`);
  }

  private _onChatMessage(sender: WebSocket, forwardMessage: ChatMessage){
    console.log(`(${forwardMessage.id})[ ${forwardMessage.name} ]: ${forwardMessage.message}`);

    this._clientList.forEach((client) => {
      if (client.socket !== sender && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(forwardMessage));
      }
    });
  }

  private _onHandshakeMessage(ws: WebSocket, handshakeMessage: HandShakeMessage){
    const localMatchIdx: UniqueSocketConnection | undefined = this._clientList.find((client) => client.id === handshakeMessage.id);
    let client: UniqueSocketConnection | undefined = undefined
    
    if (handshakeMessage.name === '' && handshakeMessage.id === '') {
      const newClient: UniqueSocketConnection = this._createNewLocalClient(ws);
      this._sendHandshakeMessage(ws, newClient);
      client = newClient;
      
    }else{
      if (localMatchIdx){
        localMatchIdx.socket = ws;
        client = localMatchIdx;
      }else{
        const newClient: UniqueSocketConnection = this._createNewLocalClient(ws, handshakeMessage.id, handshakeMessage.name);
        this._sendHandshakeMessage(ws, newClient);
        client = newClient;
      }

    console.log(`New client connected ${client.name} ${client.id}`);
    }
  }

  private _onClientMessage(ws: WebSocket, data: string){
    const parsedData: WSMessage = JSON.parse(data);

    if (parsedData.type === 'handshake') {
      this._onHandshakeMessage(ws, parsedData as HandShakeMessage);

    }else if (parsedData.type === 'chat') {
      this._onChatMessage(ws, parsedData as ChatMessage);
    }
  }

  private _createNewLocalClient(ws: WebSocket, id?: string, name?: string) : UniqueSocketConnection{
    const newClient = { 
      id: id ? id : nanoid(), 
      name: name ? name : this._generateRandName(), 
      socket: ws 
    };

    this._clientList.push(newClient);

    return newClient;
  }

  private _sendHandshakeMessage(ws: WebSocket, newClient: UniqueSocketConnection){
    const handshakeMessage: HandShakeMessage = {
      type: 'handshake',
      id: newClient.id,
      name: newClient.name
    };

    ws.send(JSON.stringify(handshakeMessage));
  }

  private _activeConnectionsCheck(ms: number){
    setInterval(() => {
      this._clientList = this._clientList.filter((client) => {
        if (client.socket.readyState === WebSocket.CLOSED) {
          console.log(`Client disconnected ${client.name} ${client.id}`);
          return false;
        }
        return true;
      });
    }, ms);
  }

  private _generateRandName(): string{
    const randomName = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals] });
    return randomName
  }
}