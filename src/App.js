import {Routes, Route, Link} from 'react-router-dom'

import Main from './pages/main/main.js';
import Dashboard from './pages/dashboard/menu.js';
import Navbar from './pages/navbar/navbar.js';
import Register from './pages/register/register.js';

function App() {
  return (
    <Routes>
      <Route path='/' element={<Main></Main>}></Route>
      <Route path='/registrar' element={<Register></Register>}/>
      <Route path='/dashboard' element={<Dashboard></Dashboard>}/>
    </Routes>
  );
}

export default App;
