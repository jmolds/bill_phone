// TODO: Future: Support multi-person calls with Bill if availabilities align
// TODO: Future: Trigger push notifications for available users to join group calls
import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Cropper from 'react-easy-crop';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import axios from 'axios';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);
const API_BASE = 'https://api.justinmolds.com';

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
      resolve(canvas.toDataURL('image/jpeg', 1.0)); // Maximum quality
    };
    image.onerror = reject;
  });
}

// Profile Image Component with error handling
function ProfileImage({ userId, userName, style = {} }) {
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (userId) {
      setImageUrl(`${API_BASE}/family-users/${userId}/picture?t=${Date.now()}`);
      setImageError(false);
    }
  }, [userId]);

  const handleImageError = () => {
    console.warn(`Failed to load image for user ${userName} (${userId})`);
    setImageError(true);
  };

  if (imageError || !userId) {
    return (
      <div style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        background: '#eee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32,
        color: '#bbb',
        marginBottom: 8,
        ...style
      }}>
        {userName ? userName.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={userName}
      style={{
        width: 64,
        height: 64,
        borderRadius: '50%',
        objectFit: 'cover',
        marginBottom: 8,
        ...style
      }}
      onError={handleImageError}
      onLoad={() => setImageError(false)}
    />
  );
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
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE}/family-users`);
      setUsers(res.data);
      console.log('Fetched users:', res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(`Failed to fetch users: ${err.response?.data?.error || err.message}`);
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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image file too large. Please select an image under 5MB');
        return;
      }
      
      setPicture(file);
      setPictureUrl(URL.createObjectURL(file));
      setShowCropper(true);
      setError('');
      console.log('Image selected:', file.name, file.size, file.type);
    }
  }

  function onCropComplete(_, croppedAreaPixels) {
    setCroppedAreaPixels(croppedAreaPixels);
  }

  // Actually crop and save image
  const handleCropDone = useCallback(async () => {
    if (pictureUrl && croppedAreaPixels) {
      try {
        const cropped = await getCroppedImg(pictureUrl, croppedAreaPixels);
        setCroppedImage(cropped);
        console.log('Image cropped successfully, data URL length:', cropped.length);
      } catch (error) {
        console.error('Error cropping image:', error);
        setError('Failed to crop image. Please try again.');
      }
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
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        name: name.trim(),
        availability
      };
      
      // Only include image data if we have a cropped image
      if (croppedImage) {
        payload.picture_data = croppedImage;
        console.log('Submitting with image data, length:', croppedImage.length);
      }
      
      console.log('Submitting payload:', {
        ...payload,
        picture_data: payload.picture_data ? `[base64 data, ${payload.picture_data.length} chars]` : 'none'
      });
      
      let resp;
      if (editUserId) {
        // PATCH update
        resp = await axios.patch(`${API_BASE}/family-users/${editUserId}`, payload);
        console.log('Profile updated:', resp.data);
        alert(`Profile updated! Name: ${resp.data.name}`);
      } else {
        // POST create
        resp = await axios.post(`${API_BASE}/family-users`, payload);
        console.log('Profile created:', resp.data);
        alert(`Profile saved! Name: ${resp.data.name}`);
      }
      
      // Reset form
      setName('');
      setPicture(null);
      setPictureUrl('');
      setCroppedImage('');
      setAvailability(() => { 
        const obj = {}; 
        DAYS.forEach(day => obj[day] = []); 
        return obj; 
      });
      setEditUserId(null);
      
      // Refresh user list
      fetchUsers();
      
    } catch (err) {
      console.error('Failed to save profile:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      setError(`Failed to save profile: ${errorMessage}`);
    }
    setLoading(false);
  }

  // Edit user handler
  function handleEditUser(user) {
    setName(user.name || '');
    setCroppedImage(''); // Don't pre-load existing image for editing
    setPicture(null);
    setPictureUrl('');
    setAvailability(user.availability || (() => { 
      const obj = {}; 
      DAYS.forEach(day => obj[day] = []); 
      return obj; 
    })());
    setEditUserId(user.id);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Delete user handler
  async function handleDeleteUser(user) {
    if (!window.confirm(`Are you sure you want to delete ${user.name}?`)) return;
    
    setLoading(true);
    setError('');
    try {
      await axios.delete(`${API_BASE}/family-users/${user.id}`);
      console.log('User deleted:', user.name);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(`Failed to delete user: ${err.response?.data?.error || err.message}`);
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', color: 'black', background: 'white', padding: 20, borderRadius: 10 }}>
      {/* Profiles section at the top */}
      <h2 style={{marginBottom: 12}}>Profiles</h2>
      <div style={{display:'flex',gap:18,marginBottom:32,overflowX:'auto',paddingBottom:8}}>
        {users.map(user => (
          <div key={user.id}
               onClick={() => setSelectedProfileId(user.id)}
               style={{cursor:'pointer',textAlign:'center',border:selectedProfileId===user.id?'2px solid #1976d2':'1px solid #ccc',borderRadius:10,padding:10,background:selectedProfileId===user.id?'#e3f2fd':'#fafafa',minWidth:90}}>
            <ProfileImage 
              userId={user.id} 
              userName={user.name}
              style={{width:60,height:60,marginBottom:6}} 
            />
            <div style={{fontWeight:'bold',fontSize:15}}>{user.name}</div>
          </div>
        ))}
      </div>

      <h2 style={{marginBottom: 12, marginTop: 0}}>
        {editUserId ? 'Edit Family User' : 'Add Family User'}
      </h2>
      
      {error && (
        <div style={{
          color: 'red', 
          background: '#fee', 
          padding: 10, 
          borderRadius: 5, 
          marginBottom: 16,
          border: '1px solid #fcc'
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 16}}>
          <label htmlFor="profile-name">Name:</label><br />
          <input 
            id="profile-name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            style={{padding: 8, fontSize: 16, width: '100%', maxWidth: 300}}
          />
        </div>
        
        <div style={{marginBottom: 16}}>
          <label htmlFor="profile-pic">Picture:</label><br />
          <input 
            id="profile-pic" 
            type="file" 
            accept="image/*" 
            onChange={handlePicChange}
            style={{marginBottom: 8}}
          />
          <br />
          {croppedImage && (
            <div>
              <p style={{fontSize: 14, color: '#666'}}>Cropped image preview:</p>
              <img src={croppedImage} alt="Cropped Preview" style={{ maxWidth: 100, margin: 8, borderRadius: 8, border: '2px solid #4caf50' }} />
            </div>
          )}
          {!croppedImage && pictureUrl && (
            <div>
              <p style={{fontSize: 14, color: '#666'}}>Original image (crop to use):</p>
              <img src={pictureUrl} alt="Preview" style={{ maxWidth: 100, margin: 8, borderRadius: 8, opacity: 0.5 }} />
            </div>
          )}
          {showCropper && pictureUrl && (
            <div style={{ position: 'relative', width: 300, height: 300, background: '#eee', marginTop: 8, border: '1px solid #ccc' }}>
              <Cropper
                image={pictureUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
              <button 
                type="button" 
                onClick={handleCropDone} 
                style={{
                  position: 'absolute', 
                  right: 10, 
                  bottom: 10,
                  background: '#4caf50',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Done Cropping
              </button>
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
                      <td style={{padding:'2px 6px', fontSize:12, textAlign:'right'}}>
                        {(hour === 12 ? 12 : hour % 12)}:00 {hour < 12 ? 'AM' : 'PM'}
                      </td>
                      {DAYS.map(day => (
                        <td key={day}>
                          <button type="button"
                            onClick={() => toggleHour(day, hour)}
                            style={{
                              width:28, 
                              height:28, 
                              borderRadius:4, 
                              border:'1px solid #ccc', 
                              background: (availability[day] || []).includes(hour) ? '#4caf50' : '#fff', 
                              color: (availability[day] || []).includes(hour) ? 'white' : '#333', 
                              cursor:'pointer', 
                              fontWeight:'bold', 
                              fontSize:13, 
                              outline:'none', 
                              margin:1
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
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#1976d2',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: 16,
            borderRadius: 4,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Saving...' : (editUserId ? 'Update Profile' : 'Create Profile')}
        </button>
        
        {editUserId && (
          <button 
            type="button"
            onClick={() => {
              setEditUserId(null);
              setName('');
              setPicture(null);
              setPictureUrl('');
              setCroppedImage('');
              setAvailability(() => { 
                const obj = {}; 
                DAYS.forEach(day => obj[day] = []); 
                return obj; 
              });
              setError('');
            }}
            style={{
              background: '#666',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              fontSize: 16,
              borderRadius: 4,
              cursor: 'pointer',
              marginLeft: 8
            }}
          >
            Cancel Edit
          </button>
        )}
      </form>
      
      {/* User list */}
      <div style={{marginTop: 32}}>
        <h3>Family Users ({users.length})</h3>
        {loading && <div>Loading...</div>}
        <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
          {users.map(user => (
            <div key={user.id} style={{border:'1px solid #ccc',borderRadius:8,padding:8,minWidth:180,textAlign:'center',background:'#fafafa'}}>
              <ProfileImage userId={user.id} userName={user.name} />
              <div style={{fontWeight:'bold'}}>{user.name}</div>
              <div style={{fontSize:12, color:'#555', marginTop:4}}>
                {user.availability && typeof user.availability === 'object' && Object.values(user.availability).some(arr => arr && arr.length)
                  ? Object.entries(user.availability).map(([day, hours]) =>
                      hours && hours.length ? `${day}: ${hours.map(h => (h === 12 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm')).join(', ')}` : null
                    ).filter(Boolean).join(' | ')
                  : 'No availability set'}
              </div>
              <div style={{marginTop:8, display:'flex', gap:8, justifyContent:'center'}}>
                <button 
                  type="button" 
                  onClick={() => handleEditUser(user)} 
                  style={{padding:'4px 12px',fontSize:13,background:'#1976d2',color:'white',border:'none',borderRadius:4,cursor:'pointer'}}
                >
                  Edit
                </button>
                <button 
                  type="button" 
                  onClick={() => handleDeleteUser(user)} 
                  style={{padding:'4px 12px',fontSize:13, color:'white', background:'#d32f2f', border:'none', borderRadius:4,cursor:'pointer'}}
                >
                  Delete
                </button>
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