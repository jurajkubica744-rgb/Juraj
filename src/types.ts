export type Position = 'forward' | 'defense' | 'goalie';

export interface Player {
  id: number;
  name: string;
  position: Position;
}

export interface GamePlayer {
  id: number;
  name: string;
  position: Position;
  team: 'red' | 'blue' | null;
}

export type WebSocketMessage = 
  | { type: 'SIGNUP_UPDATE'; data: GamePlayer }
  | { type: 'SIGNUP_REMOVED'; id: number }
  | { type: 'TEAMS_UPDATED' }
  | { type: 'GAME_RESET' };
