import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Cropper from 'react-easy-crop';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

function App() {
  // State for profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [picture, setPicture] = useState(null);
  const [pictureUrl, setPictureUrl] = useState('');
  const [availability, setAvailability] = useState({}); // For demo, simple object
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

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
  // For demo: skip actual cropping logic
  function handleCropDone() {
    setShowCropper(false);
  }

  // Dummy calendar events for demo
  const events = [
    {
      title: 'Available',
      start: new Date(2025, 4, 25, 17, 0),
      end: new Date(2025, 4, 25, 21, 0),
      allDay: false,
    },
  ];

  // Submit profile (demo: just log)
  function handleSubmit(e) {
    e.preventDefault();
    alert(`Profile submitted: ${name}, ${email}`);
    // TODO: send to backend
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', color: 'black', background: 'white', padding: 20, borderRadius: 10 }}>
      <h2>Family User Profile (React Demo)</h2>
      <form onSubmit={handleSubmit}>
        <label>Name:<br />
          <input value={name} onChange={e => setName(e.target.value)} required />
        </label><br /><br />
        <label>Email:<br />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label><br /><br />
        <label>Picture:<br />
          <input type="file" accept="image/*" onChange={handlePicChange} />
        </label><br />
        {pictureUrl && <img src={pictureUrl} alt="Preview" style={{ maxWidth: 100, margin: 8 }} />}
        {showCropper && pictureUrl && (
          <div style={{ position: 'relative', width: 300, height: 300 }}>
            <Cropper
              image={pictureUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <button type="button" onClick={handleCropDone}>Done</button>
          </div>
        )}
        <br />
        <label>Hours of the Week (Demo):</label>
        <div style={{ height: 300 }}>
          <BigCalendar
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView="week"
            views={['week']}
            toolbar={false}
            selectable
            onSelectSlot={slotInfo => alert('Select slot: ' + JSON.stringify(slotInfo))}
            onSelectEvent={event => alert('Select event: ' + event.title)}
            popup
          />
        </div>
        <br />
        <button type="submit">Submit Profile</button>
      </form>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<App />);
