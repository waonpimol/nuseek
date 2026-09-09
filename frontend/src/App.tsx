import { Routes, Route } from "react-router-dom";

import Welcome from "./pages/Welcome";
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
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/allposts" element={<Allposts />} />
      <Route path="/searchbyimage" element={<SearchByImage />} />
      <Route path="/postdetail/:id" element={<PostDetail />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/editprofile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
      <Route path="/reportfound" element={<ProtectedRoute><ReportFound /></ProtectedRoute>} />
      <Route path="/reportlost" element={<ProtectedRoute><ReportLost /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;