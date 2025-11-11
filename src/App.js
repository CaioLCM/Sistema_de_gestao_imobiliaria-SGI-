import {Routes, Route} from 'react-router-dom'

import Main from './pages/main/main.js';
import Dashboard from './pages/dashboard/menu.js';

function App() {
  return (
    <Routes>
      <Route path='/' element={<Main></Main>}></Route>
      <Route path='/dashboard' element={<Dashboard></Dashboard>}/>
    </Routes>
  );
}

export default App;
