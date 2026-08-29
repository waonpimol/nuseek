import { Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Allposts from './pages/Allposts';
import SearchByImage from './pages/SearchByImage';
import ReportFound from './pages/ReportFound';
import ReportLost from './pages/ReportLost';
import PostDetail from './pages/PostDetail';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/editprofile" element={<EditProfile />} />
      <Route path="/allposts" element={<Allposts />} />
      <Route path="/searchbyimage" element={<SearchByImage />} />
      <Route path="/reportfound" element={<ReportFound />} />
      <Route path="/reportlost" element={<ReportLost />} />
      <Route path="/postdetail/:id" element={<PostDetail />} />
    </Routes>
  );
}

export default App;