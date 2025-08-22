# IKAS Voice Commands Reference

Comprehensive reference for German voice commands supported by the IKAS voice interface.

## 🎤 Voice Activation

### Hotword Detection

**Primary Activation Phrases:**
- `"Hey Keycloak"` 
- `"Hallo Keycloak"`

**Usage:**
1. Speak the hotword clearly
2. Wait for visual/audio confirmation
3. Speak your command within 5 seconds
4. System returns to hotword mode after processing

**Example Flow:**
```
User: "Hey Keycloak"
System: [Beep sound + Visual indicator]
User: "zeige alle Benutzer"
System: [Executes command + Response]
```

## 👥 User Management Commands

### List Users
```german
"zeige alle Benutzer"
"liste alle Benutzer auf"
"Benutzer anzeigen"
"alle Benutzer"
```

**Response:** Displays user list in the Users panel with real-time data.

### User Creation
```german
"erstelle einen Benutzer"
"neuen Benutzer anlegen"
"Benutzer erstellen"
"Benutzer hinzufügen"
```

**Response:** Opens user creation form or prompts for user details.

### User Deletion
```german
"lösche Benutzer [username]"
"entferne Benutzer [username]"
"Benutzer [username] löschen"
```

**Parameters:**
- `[username]`: Replace with actual username
- **Example:** `"lösche Benutzer maxmuster"`

### User Modification
```german
"ändere Passwort für [username]"
"Passwort ändern [username]"
"bearbeite Benutzer [username]"
"modifiziere Benutzer [username]"
```

**Parameters:**
- `[username]`: Target user for modification
- **Example:** `"ändere Passwort für anna.schmidt"`

### User Search
```german
"suche Benutzer [search term]"
"finde Benutzer [search term]"
"Benutzer suchen [search term]"
```

**Parameters:**
- `[search term]`: Search query (name, email, etc.)
- **Example:** `"suche Benutzer schmidt"`

## 🔍 Analysis Commands

### User Pattern Analysis
```german
"analysiere die Benutzer"
"Benutzer-Muster analysieren"
"finde Benutzer-Patterns"
"Benutzer-Analyse starten"
```

**Response:** Initiates user behavior analysis using Neo4j graph data.

### Duplicate Detection
```german
"finde doppelte Benutzer"
"doppelte Benutzer suchen"
"Duplikate analysieren"
"zeige Duplikate"
```

**Response:** Runs duplicate user detection algorithm and displays results.

### Usage Statistics
```german
"zeige die Statistiken"
"Statistiken anzeigen"
"Nutzungsstatistiken"
"zeige die Auswertungen"
```

**Response:** Displays usage metrics and system statistics.

## ✅ Compliance Commands

### Compliance Check
```german
"analysiere die Compliance"
"Compliance-Prüfung starten"
"prüfe die Compliance"
"Compliance analysieren"
```

**Response:** Initiates comprehensive compliance analysis across all realms.

### Security Audit
```german
"starte Sicherheitsprüfung"
"Sicherheitsaudit durchführen"
"Sicherheit überprüfen"
"Security-Check starten"
```

**Response:** Performs security audit and generates compliance report.

### Policy Violations
```german
"zeige Richtlinienverletzungen"
"finde Policy-Verstöße"
"Compliance-Probleme anzeigen"
"Sicherheitswarnungen zeigen"
```

**Response:** Lists current policy violations and recommendations.

## 📊 System Commands

### Admin Events
```german
"zeige Admin Events"
"Admin-Ereignisse anzeigen"
"letzte Admin-Aktionen"
"Administrative Ereignisse"
```

**Response:** Displays recent administrative events and audit trail.

### System Status
```german
"wie ist der System-Status"
"System-Zustand prüfen"
"Systemstatus anzeigen"
"Health-Check durchführen"
```

**Response:** Shows current system health and service status.

### Realm Management
```german
"zeige alle Realms"
"Realm-Liste anzeigen"
"verfügbare Realms"
"welche Realms gibt es"
```

**Response:** Lists all available Keycloak realms.

### Service Health
```german
"prüfe alle Services"
"Service-Status anzeigen"
"sind alle Services aktiv"
"Verbindungsstatus prüfen"
```

**Response:** Displays health status of all backend services.

## 🔄 Navigation Commands

### Panel Navigation
```german
"gehe zum Dashboard"        # Navigate to main dashboard
"öffne Sprachsteuerung"     # Open voice control panel
"zeige Benutzer-Panel"      # Show users panel
"Compliance-Panel öffnen"   # Open compliance panel
"zur Analyse wechseln"      # Switch to analysis panel
```

### View Management
```german
"schließe das Panel"
"zurück zum Dashboard"
"Hauptseite anzeigen"
"Navigation öffnen"
```

## ⚙️ Settings Commands

### Theme Control
```german
"dunkles Theme aktivieren"
"Dark Mode einschalten"
"helles Theme aktivieren"
"Light Mode einschalten"
"Theme wechseln"
```

### Interface Language
```german
"Sprache auf Deutsch"
"English interface"         # Switch to English (if supported)
"Sprache wechseln"
```

### Voice Settings
```german
"Spracherkennung konfigurieren"
"Mikrofon testen"
"Sprachausgabe aktivieren"
"Voice-Feedback einschalten"
```

## 🚨 Emergency Commands

### Stop Commands
```german
"stopp"
"halt"
"abbrechen"
"stop listening"
```

**Response:** Immediately stops current operation and returns to hotword mode.

### Help Commands
```german
"Hilfe"
"was kann ich sagen"
"verfügbare Befehle"
"Command-Hilfe"
```

**Response:** Displays list of available voice commands.

## 🎚️ Advanced Command Patterns

### Multi-parameter Commands
```german
"erstelle Benutzer [username] mit Email [email]"
"ändere Benutzer [username] Rolle zu [role]"
"lösche alle Benutzer aus Realm [realm]"
```

**Examples:**
- `"erstelle Benutzer mueller mit Email m.mueller@firma.de"`
- `"ändere Benutzer schmidt Rolle zu admin"`

### Conditional Commands
```german
"zeige alle aktiven Benutzer"
"liste deaktivierte Benutzer auf"
"finde Benutzer ohne Email"
"zeige Admin-Benutzer"
```

### Batch Operations
```german
"exportiere alle Benutzer"
"importiere Benutzer aus Datei"
"synchronisiere alle Realms"
"backup aller Einstellungen"
```

## 🔧 Configuration & Troubleshooting

### Voice Recognition Settings

**Recommended Browser Settings:**
- **Chrome:** Settings → Privacy → Site Settings → Microphone → Allow
- **Firefox:** Preferences → Privacy & Security → Permissions → Microphone
- **Safari:** Safari → Preferences → Websites → Microphone → Allow

**Language Configuration:**
```javascript
// Browser language should be set to German (Germany)
navigator.language = 'de-DE'
```

### Performance Optimization

**For Better Recognition:**
1. **Speak clearly** and at normal pace
2. **Use standard German pronunciation** (Hochdeutsch)
3. **Minimize background noise**
4. **Wait for confirmation** before speaking commands
5. **Use exact command phrases** from this documentation

### Confidence Thresholds

| Confidence Level | Action |
|------------------|--------|
| > 0.9 | Execute immediately |
| 0.7 - 0.9 | Execute with confirmation |
| 0.5 - 0.7 | Request clarification |
| < 0.5 | Reject and ask to repeat |

### Browser Compatibility

| Browser | Support Level | Notes |
|---------|---------------|-------|
| Chrome 90+ | ✅ Full Support | Best performance |
| Edge 90+ | ✅ Full Support | Webkit-based version |
| Firefox 85+ | ⚠️ Limited | Requires media.webspeech.recognition.enable |
| Safari 14+ | ⚠️ Limited | iOS/macOS only |

### Common Issues

**"Voice Recognition Not Working":**
- Ensure microphone permissions are granted
- Check if using HTTPS or localhost
- Verify German language pack is installed
- Clear browser cache and reload

**"Commands Not Recognized":**
- Speak more slowly and clearly
- Use exact phrases from this documentation
- Check for background noise interference
- Ensure system language is set to German

**"Low Confidence Scores":**
- Improve audio input quality
- Reduce background noise
- Speak closer to microphone
- Use standard German pronunciation

**"Hotword Not Detected":**
- Speak "Hey Keycloak" clearly
- Wait 1-2 seconds between hotword and command
- Check hotword sensitivity settings
- Verify microphone input levels

### Advanced Configuration

**Custom Hotwords** (Developer Mode):
```javascript
// Add custom hotwords to voice service
voiceService.setHotwords([
  'hey keycloak',
  'hallo keycloak',
  'ok keycloak',     // Custom addition
  'keycloak assistant' // Custom addition
]);
```

**Confidence Tuning:**
```javascript
// Adjust recognition sensitivity
voiceService.setConfidenceThreshold(0.75); // Default: 0.7
```

**Language Models:**
```javascript
// Enhanced German language model
voiceService.setLanguageModel('de-DE-enhanced');
```

## 📝 Command Development

### Adding New Commands

1. **Define German phrases** in `voice.ts`
2. **Add command patterns** to recognition engine
3. **Implement handlers** in WebSocket service
4. **Update this documentation**
5. **Add test cases** for new commands

### Command Testing

```bash
# Test voice recognition with mock inputs
npm run test:voice

# Integration tests for command processing
npm run test:commands

# End-to-end voice workflow tests
npm run test:e2e-voice
```

---

**Last Updated:** December 2024  
**Version:** IKAS Frontend v0.1.0  
**Language Support:** German (de-DE) Primary