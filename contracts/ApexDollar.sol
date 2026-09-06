// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Apex-issued token for Base. This is not Tether USD₮ and has no guaranteed fiat value.
contract ApexDollar {
    string public constant name = "Apex Dollar";
    string public constant symbol = "APXD";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable admin;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(address admin_) {
        require(admin_ != address(0), "admin is zero");
        admin = admin_;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == admin, "not admin");
        require(to != address(0), "recipient is zero");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        require(approved >= amount, "insufficient allowance");
        allowance[from][msg.sender] = approved - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(to != address(0), "recipient is zero");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
