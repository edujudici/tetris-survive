
export const GRID_SIZE = 40;
export const COLUMNS = 12;
export const ROWS = 18; // Reduzi ligeiramente a quantidade de linhas para não estourar a altura da maioria das telas
export const CANVAS_WIDTH = GRID_SIZE * COLUMNS;
export const CANVAS_HEIGHT = GRID_SIZE * ROWS;

export const GRAVITY = 0.5;
export const JUMP_FORCE = -11; // Ajuste leve no pulo para a nova escala
export const PLAYER_SPEED = 6; // Ajuste leve na velocidade

export type DifficultyLevel = 'FACIL' | 'MEDIO' | 'DIFICIL' | 'HARD';

export const DIFFICULTY_CONFIG = {
  FACIL: {
    spawnRate: 2000,
    fallSpeed: 2.0,
    label: 'Fácil',
    color: 'bg-green-500'
  },
  MEDIO: {
    spawnRate: 1500,
    fallSpeed: 3.0,
    label: 'Médio',
    color: 'bg-yellow-500'
  },
  DIFICIL: {
    spawnRate: 1000,
    fallSpeed: 5.0,
    label: 'Difícil',
    color: 'bg-red-500'
  },
  HARD: {
    spawnRate: 600,
    fallSpeed: 7.5,
    label: 'HARDCORE',
    color: 'bg-purple-600'
  }
};
