import { useState, useEffect, useRef } from 'react';

const PHRASES = [
  'the wifi password is ILoveMyEx2024...',
  'my server root password, please forget it immediately...',
  'the API key you asked for, yes the one that costs $4/call...',
  'the combination is 34-12-07, like my birthday no one remembers...',
  "here's the login, don't screenshot this... I know you will...",
  "here's what really happened on the island...",
  'my SSN for the application, no identity theft pls...',
  'the recovery codes, because I forgot my password again...',
  "grandma's secret recipe, she'd haunt me for this...",
  'the answer is yes, but if anyone asks I said no...',
  'gate code: 4891#, changes friday so hurry up...',
  'temporary password: kX9!mQ2r, yes I smashed my keyboard...',
  'the meeting is off the record, like most of congress...',
  'bank details for the transfer, btw I am a prince I promise...',
  'so this guy called Lazar told me about level S-4 in nevada...',
];

const TYPE_SPEED = 50;
const DELETE_SPEED = 30;
const PAUSE_AFTER_TYPE = 2000;
const PAUSE_AFTER_DELETE = 400;

export function useTypewriter(active: boolean): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(Math.floor(Math.random() * PHRASES.length));
  const phaseRef = useRef<'typing' | 'paused' | 'deleting' | 'waiting'>(
    'typing',
  );
  const charRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setDisplayed('');
      charRef.current = 0;
      phaseRef.current = 'typing';
      indexRef.current = Math.floor(Math.random() * PHRASES.length);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const phrase = PHRASES[indexRef.current] ?? '';

      switch (phaseRef.current) {
        case 'typing': {
          charRef.current++;
          setDisplayed(phrase.slice(0, charRef.current));
          if (charRef.current >= phrase.length) {
            phaseRef.current = 'paused';
            timer = setTimeout(tick, PAUSE_AFTER_TYPE);
          } else {
            timer = setTimeout(tick, TYPE_SPEED + Math.random() * 40);
          }
          break;
        }
        case 'paused': {
          phaseRef.current = 'deleting';
          timer = setTimeout(tick, DELETE_SPEED);
          break;
        }
        case 'deleting': {
          charRef.current--;
          setDisplayed(phrase.slice(0, charRef.current));
          if (charRef.current <= 0) {
            phaseRef.current = 'waiting';
            timer = setTimeout(tick, PAUSE_AFTER_DELETE);
          } else {
            timer = setTimeout(tick, DELETE_SPEED);
          }
          break;
        }
        case 'waiting': {
          indexRef.current = (indexRef.current + 1) % PHRASES.length;
          charRef.current = 0;
          phaseRef.current = 'typing';
          timer = setTimeout(tick, TYPE_SPEED);
          break;
        }
      }
    }

    timer = setTimeout(tick, TYPE_SPEED);

    return () => clearTimeout(timer);
  }, [active]);

  return displayed;
}
