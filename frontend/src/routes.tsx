import { RouteObject, createHashRouter } from 'react-router-dom';

import { Dashboard } from './screens/Dashboard';
import { Memento } from './screens/Memento';
import { Root } from './screens/Root';
import { Trombinoscope } from './screens/Trombinoscope';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'memento', element: <Memento /> },
      { path: 'trombinoscope', element: <Trombinoscope /> },
    ],
  },
];

// Hash router : app servie sous `/viescolaire` (route serveur unique), routage dans le fragment. CCTP 51C.
export const router = createHashRouter(routes);
