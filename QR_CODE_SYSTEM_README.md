# QR Code Automated Action System

This system allows QR codes to automatically perform actions in Holons when scanned, with Telegram authentication for user identification and security.

## 🚀 Features

- **Automated Actions**: QR codes can trigger role assignments, event participation, task assignments, badge awards, and more
- **Telegram Authentication**: Secure user identification through Telegram Web App integration
- **Real-time Processing**: Actions are processed immediately and synchronized across the Holon
- **Audit Trail**: All actions are logged with timestamps and user information
- **Mobile Optimized**: Responsive design that works on all devices

## 📱 How It Works

1. **Scan QR Code**: User scans a QR code with their phone
2. **Telegram Login**: User authenticates with their Telegram account
3. **Automatic Action**: System processes the action based on QR code parameters
4. **Feedback & Redirect**: User receives confirmation and is redirected to relevant section

## 🔧 Supported Action Types

### 1. Role Assignment (`action=role`)
Assigns a specific role to the user in the holon.

**Example URL:**
```
/qr?action=role&title=Event%20Organizer&desc=Responsible%20for%20organizing%20community%20events&holonID=holon123
```

**Parameters:**
- `action`: Must be "role"
- `title`: Name of the role to assign
- `desc`: Description of the role (optional)
- `holonID`: ID of the holon where the role will be assigned
- `deckId`: ID of the deck containing the role (optional)
- `cardId`: ID of the specific role card (optional)

### 2. Event Participation (`action=event`)
Adds the user to an event or activity.

**Example URL:**
```
/qr?action=event&title=Community%20Workshop&desc=Join%20our%20monthly%20workshop&holonID=holon123
```

### 3. Task Assignment (`action=task`)
Assigns a specific task to the user.

**Example URL:**
```
/qr?action=task&title=Content%20Creation&desc=Create%20weekly%20newsletter&holonID=holon123
```

### 4. Badge Award (`action=badge`)
Awards a badge or achievement to the user.

**Example URL:**
```
/qr?action=badge&title=First%20Contribution&desc=Awarded%20for%20first%20contribution&holonID=holon123
```

### 5. Invitation (`action=invite`)
Processes an invitation to join or participate.

**Example URL:**
```
/qr?action=invite&title=Community%20Invitation&desc=Invitation%20from%20John%20Doe&holonID=holon123
```

## 🛠️ Implementation

### Components

1. **TelegramAuth.svelte**: Handles Telegram authentication
2. **QRActionService**: Processes QR code actions
3. **QR Code Page**: Main interface for QR code processing

### Files Structure

```
src/
├── components/
│   ├── TelegramAuth.svelte          # Telegram authentication component
│   └── QRCode.svelte               # QR code display component
├── utils/
│   └── qr-action-service.ts        # Action processing service
├── routes/
│   ├── qr/
│   │   └── +page.svelte            # Main QR code page
│   └── qr-demo/
│       └── +page.svelte            # Demo page
└── app.d.ts                        # Global types including Telegram Web App
```

### Setting Up Telegram Authentication

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Create a new bot with `/newbot`
   - Get your bot token

2. **Configure Web App**:
   - Set up your bot to handle Web App initialization
   - Configure the bot to work with your domain

3. **Environment Variables**:
   ```bash
   # Add to your .env file
   VITE_TELEGRAM_BOT_TOKEN=your_bot_token_here
   VITE_TELEGRAM_BOT_USERNAME=your_bot_username
   ```

## 📋 Usage Examples

### Creating a Role Assignment QR Code

```javascript
// Generate QR code URL for role assignment
const roleQRUrl = `/qr?action=role&title=Event%20Organizer&desc=Responsible%20for%20organizing%20community%20events&holonID=holon123`;

// Convert to QR code using any QR generator
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(roleQRUrl)}`;
```

### Testing the System

1. Visit `/qr-demo` to see example actions
2. Click "Test Action" on any example to try it out
3. Use the Telegram authentication to complete the action

## 🔒 Security Features

- **Telegram Authentication**: Users must authenticate with their Telegram account
- **Holon Access Control**: Actions are restricted to specific holons
- **Parameter Validation**: All QR code parameters are validated before processing
- **Audit Logging**: All actions are logged with user and timestamp information

## 🚀 Deployment

### Prerequisites

- Node.js 18+ and npm/yarn
- SvelteKit project setup
- HoloSphere backend configured
- Telegram bot created and configured

### Installation

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and Deploy**:
   ```bash
   npm run build
   npm run preview
   ```

## 🧪 Testing

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Visit `http://localhost:5173/qr-demo` to see the demo

3. Test QR code actions with different parameters

### Testing QR Codes

1. **Generate Test QR Codes**:
   - Use the demo page to generate test URLs
   - Convert URLs to QR codes using online generators
   - Test with mobile devices

2. **Test Authentication Flow**:
   - Ensure Telegram authentication works
   - Test action processing
   - Verify data persistence

## 🔧 Customization

### Adding New Action Types

1. **Extend QRActionService**:
   ```typescript
   // Add new case in processQRAction method
   case 'custom':
       return await this.processCustomAction(params, user);
   ```

2. **Implement Action Method**:
   ```typescript
   private async processCustomAction(
       params: QRActionParams,
       user: TelegramUser
   ): Promise<QRActionResult> {
       // Implementation here
   }
   ```

3. **Update Validation**:
   ```typescript
   const validActions = ['role', 'event', 'task', 'badge', 'invite', 'custom'];
   ```

### Customizing UI

- Modify `TelegramAuth.svelte` for authentication UI changes
- Update `QRCode.svelte` for QR code display customization
- Customize the main QR page layout and styling

## 🐛 Troubleshooting

### Common Issues

1. **Telegram Authentication Fails**:
   - Check bot token configuration
   - Verify domain is allowed in bot settings
   - Check browser console for errors

2. **Actions Not Processing**:
   - Verify HoloSphere connection
   - Check parameter validation
   - Review browser console for errors

3. **QR Code Not Scanning**:
   - Ensure URL parameters are properly encoded
   - Check QR code size and quality
   - Test with different QR scanner apps

### Debug Mode

Enable debug logging by setting:
```javascript
localStorage.setItem('debug', 'true');
```

## 📚 API Reference

### QRActionService Methods

- `processQRAction(params, user)`: Process a QR code action
- `validateQRParams(params)`: Validate QR code parameters
- `getAvailableActions(holonID, user)`: Get user's available actions

### TelegramAuth Events

- `authSuccess`: Fired when authentication succeeds
- `logout`: Fired when user logs out
- `manualAuth`: Fired when manual authentication is requested

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and feature requests via GitHub issues
- **Community**: Join our community channels for help and discussion

## 🔮 Future Enhancements

- **Batch Actions**: Process multiple actions from a single QR code
- **Conditional Actions**: Actions that depend on user state or conditions
- **Advanced Permissions**: Role-based action restrictions
- **Analytics Dashboard**: Track QR code usage and effectiveness
- **Mobile App**: Native mobile app for better QR code scanning
- **Offline Support**: Actions that can be processed offline and synced later
