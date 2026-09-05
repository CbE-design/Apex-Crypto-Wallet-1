// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title Apex USDT-like ERC20 token
/// @notice ERC20 token with 6 decimals and a MINTER_ROLE for treasury-controlled minting.
/// @dev Uses OpenZeppelin ERC20 + AccessControl. Symbol is "USDT" as requested.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ApexUSDT is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // USDT uses 6 decimals
    uint8 private constant _DECIMALS = 6;

    /// @param admin The address that will receive DEFAULT_ADMIN_ROLE and MINTER_ROLE
    constructor(address admin) ERC20("Apex USDT", "USDT") {
        require(admin != address(0), "admin=zero");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Return token decimals (6)
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint tokens to `to`. Restricted to MINTER_ROLE (treasury).
    /// @param to Recipient address
    /// @param amount Amount in token base units (6 decimals). Example: 1000 USDT => 1000 * 10**6
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "mint to zero");
        _mint(to, amount);
    }

    /// @notice Optional administrative burn (only DEFAULT_ADMIN_ROLE)
    /// @dev Use only if you need admin-controlled burning (e.g., reclaim / fee handling).
    function adminBurn(address from, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _burn(from, amount);
    }

    /// @notice Recover ERC20 tokens accidentally sent to this contract (admin only).
    function recoverERC20(address tokenAddress, uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "to zero");
        IERC20(tokenAddress).transfer(to, amount);
    }
}
