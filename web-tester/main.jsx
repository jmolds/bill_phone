import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Cropper from 'react-easy-crop';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import axios from 'axios';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const API_BASE = 'http://143.198.180.248:3000'; // Adjust if needed


// Helper to crop image to canvas and return data URL
function getCroppedImg(imageSrc, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
      );
      resolve(canvas.toDataURL('image/jpeg'));
    };
    image.onerror = reject;
  });
}


function App() {
  // State for profile
  const [name, setName] = useState('');
  const [picture, setPicture] = useState(null);
  const [pictureUrl, setPictureUrl] = useState('');
  const [croppedImage, setCroppedImage] = useState('');
  // Weekly availability: { [day]: [hours] }
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS = Array.from({length: 14}, (_, i) => i + 9); // 9am to 10pm
  const [availability, setAvailability] = useState(() => {
    // { Mon: [9,10,11], Tue: [14,15], ... }
    const obj = {};
    DAYS.forEach(day => obj[day] = []);
    return obj;
  });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  // User list
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editUserId, setEditUserId] = useState(null);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/family-users`);
      setUsers(res.data);
    } catch (err) {
      setError('Failed to fetch users');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle image selection
  function handlePicChange(e) {
    const file = e.target.files[0];
    if (file) {
      setPicture(file);
      setPictureUrl(URL.createObjectURL(file));
      setShowCropper(true);
    }
  }
  function onCropComplete(_, croppedAreaPixels) {
    setCroppedAreaPixels(croppedAreaPixels);
  }
  // Actually crop and save image
  const handleCropDone = useCallback(async () => {
    if (pictureUrl && croppedAreaPixels) {
      const cropped = await getCroppedImg(pictureUrl, croppedAreaPixels);
      setCroppedImage(cropped);
    }
    setShowCropper(false);
  }, [pictureUrl, croppedAreaPixels]);

  // Toggle hour block for a given day
  function toggleHour(day, hour) {
    setAvailability(avail => {
      const hours = avail[day] || [];
      if (hours.includes(hour)) {
        return { ...avail, [day]: hours.filter(h => h !== hour) };
      } else {
        return { ...avail, [day]: [...hours, hour].sort((a,b)=>a-b) };
      }
    });
  }

  // Submit profile and save to backend
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let resp;
      if (editUserId) {
        // PATCH update
        resp = await axios.patch(`${API_BASE}/family-users/${editUserId}`, {
          name,
          picture_url: croppedImage,
          availability
        });
        alert(`Profile updated! Name: ${resp.data.name}`);
      } else {
        // Save profile to backend
        resp = await axios.post(`${API_BASE}/family-users`, {
          name,
          picture_url: croppedImage,
          availability
        });
        alert(`Profile saved! Name: ${resp.data.name}`);
      }
      setName('');
      setPicture(null);
      setPictureUrl('');
      setCroppedImage('');
      setAvailability(() => { const obj = {}; DAYS.forEach(day => obj[day] = []); return obj; });
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to save profile');
    }
    setLoading(false);
  }

  // Edit user handler
  function handleEditUser(user) {
    setName(user.name || '');
    setCroppedImage(user.picture_url || '');
    setPicture(null);
    setPictureUrl('');
    setAvailability(user.availability || (() => { const obj = {}; DAYS.forEach(day => obj[day] = []); return obj; })());
    setEditUserId(user.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Delete user handler
  async function handleDeleteUser(user) {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`)) return;
    setLoading(true);
    setError('');
    try {
      await axios.delete(`${API_BASE}/family-users/${user.id}`);
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    }
    setLoading(false);
  }
      setCroppedImage('');
      setAvailability(() => { const obj = {}; DAYS.forEach(day => obj[day] = []); return obj; });
      setEditUserId(null);
      fetchUsers();
    } catch (err) {
      setError('Failed to save profile');
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', color: 'black', background: 'white', padding: 20, borderRadius: 10 }}>
      <h2>Family User Profile (React Demo)</h2>
      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 16}}>
          <label htmlFor="profile-name">Name:</label><br />
          <input id="profile-name" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div style={{marginBottom: 16}}>
          <label htmlFor="profile-pic">Picture:</label><br />
          <input id="profile-pic" type="file" accept="image/*" onChange={handlePicChange} />
          <br />
          {croppedImage && (
            <img src={croppedImage} alt="Cropped Preview" style={{ maxWidth: 100, margin: 8, borderRadius: 8 }} />
          )}
          {!croppedImage && pictureUrl && (
            <img src={pictureUrl} alt="Preview" style={{ maxWidth: 100, margin: 8, borderRadius: 8, opacity: 0.5 }} />
          )}
          {showCropper && pictureUrl && (
            <div style={{ position: 'relative', width: 300, height: 300, background: '#eee', marginTop: 8 }}>
              <Cropper
                image={pictureUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
              <button type="button" onClick={handleCropDone} style={{position: 'absolute', right: 10, bottom: 10}}>Done</button>
            </div>
          )}
        </div>
        <div style={{marginBottom: 16}}>
          <fieldset style={{border: 'none', margin: 0, padding: 0}}>
            <legend style={{fontWeight: 600, marginBottom: 8}}>Weekly Availability (EST):</legend>
            <div style={{overflowX:'auto', marginTop:8}}>
              <table style={{borderCollapse:'collapse', background:'#f9f9f9', borderRadius:8, width:'100%', minWidth:600}}>
                <thead>
                  <tr>
                    <th style={{width:50}}></th>
                    {DAYS.map(day => <th key={day} style={{padding:'4px 8px'}}>{day}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map(hour => (
                    <tr key={hour}>
                      <td style={{padding:'2px 6px', fontSize:12, textAlign:'right'}}>{(hour === 12 ? 12 : hour % 12)}:00 {hour < 12 ? 'AM' : 'PM'}</td>
                      {DAYS.map(day => (
                        <td key={day}>
                          <button type="button"
                            onClick={() => toggleHour(day, hour)}
                            style={{
                              width:28, height:28, borderRadius:4, border:'1px solid #ccc', background: (availability[day] || []).includes(hour) ? '#4caf50' : '#fff', color: (availability[day] || []).includes(hour) ? 'white' : '#333', cursor:'pointer', fontWeight:'bold', fontSize:13, outline:'none', margin:1
                            }}
                            aria-label={`Toggle ${day} ${hour}:00`}
                          >
                            {(availability[day] || []).includes(hour) ? '✓' : ''}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{fontSize:12, color:'#666', marginTop:4}}>
              Selected: {DAYS.map(day => (availability[day] || []).length ? `${day}: ${availability[day].join(', ')}` : null).filter(Boolean).join(' | ') || 'None'}
            </div>
          </fieldset>
        </div> 
        <button type="submit">Submit Profile</button>
      </form>
      {/* User list */}
      <div style={{marginTop: 32}}>
        <h3>Family Users</h3>
        {loading && <div>Loading...</div>}
        {error && <div style={{color:'red'}}>{error}</div>}
        <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
          {users.map(user => (
            <div key={user.id} style={{border:'1px solid #ccc',borderRadius:8,padding:8,minWidth:180,textAlign:'center',background:'#fafafa'}}>
              {user.picture_url && <img src={user.picture_url} alt={user.name} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',marginBottom:8}} />}
              <div style={{fontWeight:'bold'}}>{user.name}</div>
              <div style={{fontSize:12, color:'#555', marginTop:4}}>
                {user.availability && typeof user.availability === 'object' && Object.values(user.availability).some(arr => arr.length)
                  ? Object.entries(user.availability).map(([day, hours]) =>
                      hours.length ? `${day}: ${hours.map(h => (h === 12 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm')).join(', ')}` : null
                    ).filter(Boolean).join(' | ')
                  : 'No availability set'}
              </div>
              <div style={{marginTop:8, display:'flex', gap:8, justifyContent:'center'}}>
                <button type="button" onClick={() => handleEditUser(user)} style={{padding:'2px 10px',fontSize:13}}>Edit</button>
                <button type="button" onClick={() => handleDeleteUser(user)} style={{padding:'2px 10px',fontSize:13, color:'white', background:'#d32f2f', border:'none', borderRadius:4}}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(
  <div>
    <h2 style={{color: 'red'}}>Profile UI Below (React)</h2>
    <App />
  </div>
);
