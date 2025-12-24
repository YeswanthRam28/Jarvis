"""
Compatibility fixes for environment-specific issues
Handles torch/transformers version mismatches and other library quirks
"""
import sys
from utils.logger import get_logger

logger = get_logger("jarvis.compatibility")

def apply_fixes():
    """Apply all compatibility fixes"""
    fix_torch_pytree()

def fix_torch_pytree():
    """
    Fix for AttributeError: module 'torch.utils._pytree' has no attribute 'register_pytree_node'
    Common in some torch/transformers version mismatches
    """
    try:
        import torch
        if hasattr(torch.utils, "_pytree"):
            import torch.utils._pytree as _pytree
            if not hasattr(_pytree, "register_pytree_node"):
                logger.info("Applying fix for torch.utils._pytree.register_pytree_node")
                
                # Try to find where it might be (sometimes it's in torch.utils._pytree directly or under a different name)
                # If we can't find it, we provide a dummy that allows transformers to at least import
                def register_pytree_node(cls, flatten_fn, unflatten_fn, *args, **kwargs):
                    # Mock implementation
                    pass
                
                _pytree.register_pytree_node = register_pytree_node
                
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Failed to apply torch pytree fix: {e}")
