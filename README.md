# TempMail - Free Disposable Email Service

A modern, secure, and user-friendly disposable email service similar to TempMail.com. Built with Node.js, Express, and a beautiful responsive UI.

## ✨ Features

- **Instant Email Generation**: Create temporary email addresses instantly
- **Real-time Inbox**: Auto-refresh inbox every 10 seconds
- **Email Preview**: View email content in a beautiful modal
- **Copy to Clipboard**: One-click email address copying
- **Responsive Design**: Works perfectly on desktop and mobile
- **Modern UI**: Clean, professional interface with smooth animations
- **Auto-refresh Toggle**: Enable/disable automatic inbox refresh
- **Message Management**: Clear inbox and delete individual messages
- **Session Management**: Secure token-based authentication
- **Error Handling**: Comprehensive error handling and user feedback

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone or download the project
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and visit:
   ```
   http://localhost:3000
   ```

### Development Mode

For development with auto-restart:
```bash
npm run dev
```

## 🛠️ API Endpoints

### Generate Email
```
GET /api/generate
```
Creates a new temporary email address and returns authentication token.

**Response:**
```json
{
  "address": "user123@domain.com",
  "token": "auth_token_here",
  "sessionId": "session_id",
  "domain": "domain.com",
  "expiresAt": 1640995200000
}
```

### Get Messages
```
GET /api/messages?token={token}
```
Retrieves all messages for the authenticated email address.

### Get Single Message
```
GET /api/message/{id}?token={token}
```
Retrieves a specific message by ID.

### Delete Message
```
DELETE /api/message/{id}?token={token}
```
Deletes a specific message by ID.

### Get Available Domains
```
GET /api/domains
```
Returns list of available email domains.

### Check Token Status
```
GET /api/status?token={token}
```
Validates if the authentication token is still valid.

## 🎨 UI Features

### Email Generation
- One-click email address generation
- Visual feedback during generation process
- Copy to clipboard functionality
- Professional email input styling

### Inbox Management
- Real-time message updates
- Email preview with sender and subject
- Click to view full email content
- Auto-refresh toggle
- Clear inbox functionality

### Email Viewer
- Modal-based email viewing
- HTML and text email support
- Responsive design
- Keyboard shortcuts (ESC to close)

### Notifications
- Success, warning, and error notifications
- Auto-dismissing toast messages
- Professional styling with icons

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

### Customization

The service uses the Mail.tm API for email functionality. You can customize:

- Email domains by modifying the domain selection logic
- Auto-refresh interval (currently 10 seconds)
- Session timeout (currently 24 hours)
- UI colors and styling in the CSS

## 🛡️ Security Features

- Token-based authentication
- Session management with automatic cleanup
- Input validation and sanitization
- Error handling without exposing sensitive information
- CORS protection
- Rate limiting considerations

## 📱 Responsive Design

The UI is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- All modern browsers

## 🎯 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers

## 🚀 Deployment

### Render.com
The service includes a `.render.yaml` file for easy deployment on Render.com.

### Other Platforms
The service can be deployed on:
- Heroku
- Vercel
- Railway
- DigitalOcean
- AWS
- Any Node.js hosting platform

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

If you encounter any issues or have questions:
1. Check the browser console for errors
2. Verify your internet connection
3. Try refreshing the page
4. Generate a new email address

## 🔄 Updates

The service automatically:
- Refreshes the inbox every 10 seconds
- Cleans up old sessions
- Handles connection errors gracefully
- Provides real-time status updates

---

**TempMail** - Your secure, anonymous, and free disposable email service! 🚀