import { useState } from 'react';
import { ko } from '../../i18n/ko';
import { Button } from '../components/Button';
import { SpeakButton } from '../components/SpeakButton';
import { useIslandBackdrop } from './useIslandBackdrop';

export function WelcomeScreen({
  onStart,
  reducedMotion = false,
}: {
  onStart(nickname: string): void;
  reducedMotion?: boolean;
}) {
  const [name, setName] = useState('');
  useIslandBackdrop(reducedMotion);
  return (
    <div className="screen-center screen-over-3d">
      <div className="card max-w-xl text-center">
        <h1 className="title">{ko.welcome.hello}</h1>
        <SpeakButton text={ko.welcome.hello} className="mx-auto mt-2" />
        <label className="mt-6 block text-2xl font-bold" htmlFor="nick">
          {ko.welcome.nickname}
        </label>
        <input
          id="nick"
          className="toy-input mt-2"
          maxLength={12}
          value={name}
          placeholder={ko.welcome.nicknamePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          tone="primary"
          big
          className="mt-6"
          onClick={() => onStart(name.trim() || ko.welcome.nicknamePlaceholder)}
        >
          {ko.welcome.start}
        </Button>
      </div>
    </div>
  );
}
