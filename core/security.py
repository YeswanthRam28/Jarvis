"""
Security Policy Enforcement for JARVIS
Implements safety restrictions and validates all actions
"""
from enum import Enum
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from utils.logger import get_logger

logger = get_logger("jarvis.security")


class RiskLevel(Enum):
    """Risk classification for tools and actions"""
    SAFE = "safe"  # No restrictions, can run freely
    MODERATE = "moderate"  # Basic validation required
    HIGH_RISK = "high_risk"  # Requires explicit user confirmation
    FORBIDDEN = "forbidden"  # Never allowed under any circumstances


@dataclass
class SecurityPolicy:
    """Security policy configuration"""
    # File system restrictions
    allow_file_read: bool = True
    allow_file_write: bool = False
    allow_file_delete: bool = False
    allow_file_modify: bool = False
    
    # System restrictions
    allow_system_shutdown: bool = False
    allow_system_restart: bool = False
    allow_registry_access: bool = False
    allow_software_install: bool = False
    
    # Network restrictions
    allow_web_search: bool = True
    allow_url_open: bool = True  # Only trusted/user-provided URLs
    allow_auto_download: bool = False
    allow_form_submission: bool = False
    allow_web_login: bool = False
    
    # Execution restrictions
    allow_autonomous_scheduling: bool = False
    allow_background_triggers: bool = False
    allow_unregistered_tools: bool = False
    
    # API restrictions
    require_api_auth: bool = True
    allow_remote_commands: bool = False
    
    # Confirmation requirements
    require_confirmation_for_high_risk: bool = True
    max_response_length: int = 500  # characters


class SecurityValidator:
    """Validates actions against security policy"""
    
    def __init__(self, policy: Optional[SecurityPolicy] = None):
        """
        Initialize security validator
        
        Args:
            policy: Security policy to enforce (uses defaults if None)
        """
        self.policy = policy or SecurityPolicy()
        
        # Forbidden keywords that should never be allowed
        self.forbidden_keywords = [
            "delete", "remove", "uninstall", "shutdown", "restart",
            "reboot", "logout", "registry", "regedit", "format",
            "rm -rf", "del /f", "rmdir", "kill process"
        ]
        
        # High-risk keywords that require confirmation
        self.high_risk_keywords = [
            "install", "download", "upload", "execute", "run script",
            "modify", "overwrite", "change settings", "admin"
        ]
        
        logger.info("Security validator initialized with policy")
    
    def classify_tool(self, tool_name: str, tool_description: str = "") -> RiskLevel:
        """
        Classify a tool's risk level
        
        Args:
            tool_name: Name of the tool
            tool_description: Description of what the tool does
            
        Returns:
            Risk level classification
        """
        tool_lower = tool_name.lower()
        desc_lower = tool_description.lower()
        combined = f"{tool_lower} {desc_lower}"
        
        # Check for forbidden operations
        for keyword in self.forbidden_keywords:
            if keyword in combined:
                logger.warning(f"Tool '{tool_name}' classified as FORBIDDEN due to keyword: {keyword}")
                return RiskLevel.FORBIDDEN
        
        # Check for high-risk operations
        for keyword in self.high_risk_keywords:
            if keyword in combined:
                logger.info(f"Tool '{tool_name}' classified as HIGH_RISK due to keyword: {keyword}")
                return RiskLevel.HIGH_RISK
        
        # Classify by tool name patterns
        if any(x in tool_lower for x in ["system", "admin", "registry", "process"]):
            return RiskLevel.HIGH_RISK
        
        if any(x in tool_lower for x in ["open", "play", "volume", "workspace"]):
            return RiskLevel.MODERATE
        
        # Default to safe for informational tools
        if any(x in tool_lower for x in ["get", "recall", "calculate", "time", "info", "stats"]):
            return RiskLevel.SAFE
        
        # Unknown tools default to moderate
        return RiskLevel.MODERATE
    
    def validate_action(
        self,
        tool_name: str,
        params: Dict[str, Any],
        user_confirmed: bool = False
    ) -> tuple[bool, Optional[str]]:
        """
        Validate if an action is allowed
        
        Args:
            tool_name: Name of the tool to execute
            params: Parameters for the tool
            user_confirmed: Whether user has explicitly confirmed this action
            
        Returns:
            Tuple of (is_allowed, reason_if_blocked)
        """
        # Classify the tool
        risk_level = self.classify_tool(tool_name)
        
        # FORBIDDEN actions are never allowed
        if risk_level == RiskLevel.FORBIDDEN:
            reason = f"Action '{tool_name}' is forbidden by security policy"
            logger.error(reason)
            return False, reason
        
        # HIGH_RISK actions require confirmation
        if risk_level == RiskLevel.HIGH_RISK:
            if self.policy.require_confirmation_for_high_risk and not user_confirmed:
                reason = f"Action '{tool_name}' requires explicit user confirmation"
                logger.warning(reason)
                return False, reason
        
        # Validate specific restrictions
        if not self._validate_specific_restrictions(tool_name, params):
            reason = f"Action '{tool_name}' violates specific security restrictions"
            logger.error(reason)
            return False, reason
        
        logger.debug(f"Action '{tool_name}' validated successfully (Risk: {risk_level.value})")
        return True, None
    
    def _validate_specific_restrictions(self, tool_name: str, params: Dict[str, Any]) -> bool:
        """
        Validate specific policy restrictions
        
        Args:
            tool_name: Name of the tool
            params: Tool parameters
            
        Returns:
            True if allowed, False otherwise
        """
        tool_lower = tool_name.lower()
        
        # File system checks
        if "file" in tool_lower:
            if "delete" in tool_lower or "remove" in tool_lower:
                return self.policy.allow_file_delete
            if "write" in tool_lower or "create" in tool_lower:
                return self.policy.allow_file_write
            if "modify" in tool_lower or "edit" in tool_lower:
                return self.policy.allow_file_modify
        
        # System checks
        if any(x in tool_lower for x in ["shutdown", "restart", "reboot"]):
            return self.policy.allow_system_shutdown or self.policy.allow_system_restart
        
        if "registry" in tool_lower:
            return self.policy.allow_registry_access
        
        if "install" in tool_lower or "uninstall" in tool_lower:
            return self.policy.allow_software_install
        
        # Network checks
        if "download" in tool_lower:
            return self.policy.allow_auto_download
        
        if "login" in tool_lower or "signin" in tool_lower:
            return self.policy.allow_web_login
        
        if "submit" in tool_lower and "form" in str(params).lower():
            return self.policy.allow_form_submission
        
        # URL validation
        if "url" in str(params).lower() or "link" in str(params).lower():
            url = str(params.get("url", ""))
            if url and not self._is_trusted_url(url):
                logger.warning(f"Untrusted URL blocked: {url}")
                return False
        
        return True
    
    def _is_trusted_url(self, url: str) -> bool:
        """
        Check if a URL is trusted
        
        Args:
            url: URL to check
            
        Returns:
            True if trusted, False otherwise
        """
        # Allow common trusted domains
        trusted_domains = [
            "google.com", "youtube.com", "github.com",
            "stackoverflow.com", "wikipedia.org",
            "microsoft.com", "apple.com"
        ]
        
        url_lower = url.lower()
        
        # Block suspicious patterns
        if any(x in url_lower for x in ["javascript:", "data:", "file://", "about:"]):
            return False
        
        # Check if it's a known trusted domain
        for domain in trusted_domains:
            if domain in url_lower:
                return True
        
        # For now, allow http/https URLs (can be made stricter)
        if url_lower.startswith("http://") or url_lower.startswith("https://"):
            return True
        
        return False
    
    def validate_response_length(self, response: str) -> tuple[bool, str]:
        """
        Validate response length doesn't exceed limits
        
        Args:
            response: Response text to validate
            
        Returns:
            Tuple of (is_valid, truncated_response_if_needed)
        """
        if len(response) <= self.policy.max_response_length:
            return True, response
        
        # Truncate and add indicator
        truncated = response[:self.policy.max_response_length - 3] + "..."
        logger.warning(f"Response truncated from {len(response)} to {len(truncated)} characters")
        return False, truncated
    
    def get_policy_summary(self) -> Dict[str, Any]:
        """
        Get a summary of current security policy
        
        Returns:
            Dictionary of policy settings
        """
        return {
            "file_operations": {
                "read": self.policy.allow_file_read,
                "write": self.policy.allow_file_write,
                "delete": self.policy.allow_file_delete,
                "modify": self.policy.allow_file_modify,
            },
            "system_operations": {
                "shutdown": self.policy.allow_system_shutdown,
                "restart": self.policy.allow_system_restart,
                "registry": self.policy.allow_registry_access,
                "software_install": self.policy.allow_software_install,
            },
            "network_operations": {
                "web_search": self.policy.allow_web_search,
                "url_open": self.policy.allow_url_open,
                "download": self.policy.allow_auto_download,
                "form_submit": self.policy.allow_form_submission,
                "web_login": self.policy.allow_web_login,
            },
            "execution_control": {
                "autonomous_scheduling": self.policy.allow_autonomous_scheduling,
                "background_triggers": self.policy.allow_background_triggers,
                "unregistered_tools": self.policy.allow_unregistered_tools,
            },
            "confirmation_required": self.policy.require_confirmation_for_high_risk,
            "max_response_length": self.policy.max_response_length,
        }


# Global security validator instance
_security_validator: Optional[SecurityValidator] = None


def get_security_validator() -> SecurityValidator:
    """Get the global security validator instance"""
    global _security_validator
    if _security_validator is None:
        _security_validator = SecurityValidator()
    return _security_validator


def validate_tool_execution(
    tool_name: str,
    params: Dict[str, Any],
    user_confirmed: bool = False
) -> tuple[bool, Optional[str]]:
    """
    Convenience function to validate tool execution
    
    Args:
        tool_name: Name of the tool
        params: Tool parameters
        user_confirmed: Whether user confirmed the action
        
    Returns:
        Tuple of (is_allowed, reason_if_blocked)
    """
    validator = get_security_validator()
    return validator.validate_action(tool_name, params, user_confirmed)
