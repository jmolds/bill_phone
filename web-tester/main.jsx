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
  const [availability, setAvailability] = useState([]); // Array of {start, end} slots
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  // User list
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  // Calendar events for selected availability
  const events = availability.map((slot, i) => ({
    ...slot,
    title: 'Available',
    allDay: false,
    id: i
  }));

  // Add slot to availability (no overlap)
  function handleSelectSlot(slotInfo) {
    const newSlot = {
      start: slotInfo.start,
      end: slotInfo.end
    };
    // Prevent overlapping slots
    const overlaps = availability.some(a =>
      (newSlot.start < a.end && newSlot.end > a.start)
    );
    if (!overlaps) {
      setAvailability([...availability, newSlot]);
    }
  }
  // Remove slot on event click
  function handleSelectEvent(event) {
    setAvailability(availability.filter((a, i) => i !== event.id));
  }

  // Submit profile and save to backend
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Save profile to backend
      const resp = await axios.post(`${API_BASE}/family-users`, {
        name,
        picture_url: croppedImage,
        availability
      });
      alert(`Profile saved! Name: ${resp.data.name}`);
      setName('');
      setPicture(null);
      setPictureUrl('');
      setCroppedImage('');
      setAvailability({});
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
          <label>Availability (Click & drag to add, click event to remove):</label>
          <div style={{ height: 300, background: '#f9f9f9', borderRadius: 8, padding: 4 }}>
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              defaultView="week"
              views={['week']}
              toolbar={false}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              popup
            />
          </div>
          <div style={{fontSize:12, color:'#666', marginTop:4}}>
            Selected slots: {availability.length === 0 ? 'None' : availability.map(a => `${a.start.toLocaleString()} - ${a.end.toLocaleString()}`).join('; ')}
          </div>
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
                {Array.isArray(user.availability) && user.availability.length > 0
                  ? user.availability.map(a => {
                      const start = new Date(a.start);
                      const end = new Date(a.end);
                      return `${start.toLocaleString([], {weekday:'short', hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleString([], {weekday:'short', hour:'2-digit', minute:'2-digit'})}`;
                    }).join('; ')
                  : 'No availability set'}
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
