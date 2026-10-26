import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAndroidBackButton } from '../src/android-navigation.js';

test('ferme une boîte de dialogue avant de modifier la navigation', () => {
  const calls = [];

  handleAndroidBackButton({
    dialog: { close: () => calls.push('close') },
    route: { name: 'game' },
    navigateHome: () => calls.push('home'),
    exitApp: () => calls.push('exit'),
  });

  assert.deepEqual(calls, ['close']);
});

test('revient à l’accueil depuis un jeu', () => {
  const calls = [];

  handleAndroidBackButton({
    dialog: null,
    route: { name: 'game' },
    navigateHome: () => calls.push('home'),
    exitApp: () => calls.push('exit'),
  });

  assert.deepEqual(calls, ['home']);
});

test('quitte depuis l’accueil', () => {
  const calls = [];

  handleAndroidBackButton({
    dialog: null,
    route: { name: 'home' },
    navigateHome: () => calls.push('home'),
    exitApp: () => calls.push('exit'),
  });

  assert.deepEqual(calls, ['exit']);
});
