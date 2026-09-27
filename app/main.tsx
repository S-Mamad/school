import React from 'react';
import {createRoot} from 'react-dom/client';
import ProductionSchool from './production-school';
import CentralDemo from './central-demo';
import './globals.css';
import './extra.css';
const App = import.meta.env.DEV && !new URLSearchParams(location.search).has('live') && !new URLSearchParams(location.search).has('legacy') ? CentralDemo : ProductionSchool;
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
if(!import.meta.env.DEV&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
