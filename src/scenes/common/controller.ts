/** A scene controller owns a root group inside the shared RenderWorld for one screen. */
import type { Raycaster } from 'three/webgpu';
import type { ActionSnapshot } from '../../infra/input/input';

export interface PointerInfo {
  type: 'down' | 'move' | 'up';
  raycaster: Raycaster;
  /** Normalised device coords. */
  x: number;
  y: number;
}

export interface SceneController {
  update(dt: number, input: ActionSnapshot): void;
  pointer?(p: PointerInfo): void;
  dispose(): void;
}
