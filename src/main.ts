/// <reference types="vite/client" />
import './styles.css';
import { mountApp } from './ui/app';

const root = document.querySelector<HTMLElement>('#app');

if (root === null) {
  throw new Error('Контейнер #app не найден: игру некуда смонтировать');
}

mountApp(root);
