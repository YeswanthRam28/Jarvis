"""
Security Restrictions Documentation for JARVIS
"""

# JARVIS Security Policy

## Overview
JARVIS operates under strict security restrictions to ensure safe operation and prevent unauthorized or dangerous actions.

## File System Restrictions
- ❌ **FORBIDDEN**: Delete files or directories
- ❌ **FORBIDDEN**: Modify or overwrite existing files
- ❌ **FORBIDDEN**: Move or rename files
- ✅ **ALLOWED**: Read file contents (with user permission)

## System Restrictions
- ❌ **FORBIDDEN**: Shutdown, restart, or log out the system
- ❌ **FORBIDDEN**: Install or uninstall software
- ❌ **FORBIDDEN**: Access or modify Windows Registry
- ❌ **FORBIDDEN**: Change system configuration files
- ❌ **FORBIDDEN**: Control hardware beyond audio devices
- ✅ **ALLOWED**: Open approved applications (browser, music player, etc.)
- ✅ **ALLOWED**: Adjust system volume

## Network & Web Restrictions
- ❌ **FORBIDDEN**: Automatically download files from the internet
- ❌ **FORBIDDEN**: Upload files to external servers
- ❌ **FORBIDDEN**: Submit forms on websites
- ❌ **FORBIDDEN**: Log in to websites or perform authentication
- ❌ **FORBIDDEN**: Perform financial transactions
- ❌ **FORBIDDEN**: Open untrusted or unknown URLs automatically
- ⚠️ **HIGH-RISK**: Open URLs (requires user confirmation for untrusted domains)
- ✅ **ALLOWED**: Search the web for information
- ✅ **ALLOWED**: Read publicly available web content

## Execution & Automation Restrictions
- ❌ **FORBIDDEN**: Run autonomous tasks or background processes
- ❌ **FORBIDDEN**: Schedule actions without explicit user command
- ❌ **FORBIDDEN**: Execute JavaScript or browser automation scripts
- ❌ **FORBIDDEN**: Trigger actions based on background audio or noise
- ❌ **FORBIDDEN**: Execute tools that are not explicitly registered
- ❌ **FORBIDDEN**: Invent or create new tools on the fly
- ✅ **ALLOWED**: Execute registered tools with user permission

## API & Remote Access Restrictions
- ❌ **FORBIDDEN**: Expose API publicly without authentication
- ❌ **FORBIDDEN**: Accept commands from remote devices without authorization
- ❌ **FORBIDDEN**: Share user data with external services
- ✅ **ALLOWED**: Local API access for UI/HUD

## Wake & Trigger Restrictions
- ❌ **FORBIDDEN**: Respond to commands without wake word or hotkey trigger
- ❌ **FORBIDDEN**: Process background conversations
- ✅ **ALLOWED**: Only respond when explicitly triggered (Win+J hotkey)

## Response Restrictions
- ⚠️ **LIMIT**: Maximum response length enforced (500 characters default)
- ❌ **FORBIDDEN**: Generate responses that encourage unsafe actions
- ❌ **FORBIDDEN**: Provide instructions for bypassing security measures

## Risk Classification

### SAFE Tools (No restrictions)
- Get current time
- Calculator
- Get system info (read-only)
- Recall memories
- Get memory statistics

### MODERATE Tools (Basic validation)
- Open applications
- Play music
- Adjust volume
- Workspace automation (pre-configured)

### HIGH-RISK Tools (Requires explicit confirmation)
- Open URLs (untrusted domains)
- System information queries (detailed)
- Any tool involving external communication

### FORBIDDEN Tools (Never allowed)
- File deletion/modification
- System shutdown/restart
- Software installation
- Registry access
- Autonomous scheduling
- Web form submission
- File downloads/uploads

## Confirmation Flow

For HIGH-RISK actions, JARVIS will:
1. Describe the action it wants to perform
2. Ask for explicit confirmation
3. Wait for user to say "confirm" or "yes"
4. Only then execute the action

Example:
```
User: "Open this link: example.com"
JARVIS: "This action requires confirmation: Opening URL example.com. Say 'confirm' to proceed."
User: "confirm"
JARVIS: [Opens the URL]
```

## Logging & Audit

All security-related events are logged:
- ✅ Allowed actions
- ❌ Blocked actions (with reason)
- ⚠️ High-risk actions requiring confirmation
- 🚨 Suspicious patterns or repeated violations

## Implementation

Security is enforced at multiple layers:
1. **LLM System Prompt**: Instructs the AI about restrictions
2. **Security Validator**: Pre-execution validation of all tools
3. **Tool Registry**: Integrated security checks before execution
4. **Risk Classification**: Automatic categorization of tools
5. **Policy Enforcement**: Configurable security policy

## Configuration

Security policy can be adjusted in `core/security.py`:
- `SecurityPolicy` class contains all restriction flags
- Default policy is maximally restrictive
- Can be customized per deployment (not recommended)

## Emergency Override

There is NO emergency override or bypass mechanism. Security restrictions are absolute and cannot be disabled through voice commands or API calls.
