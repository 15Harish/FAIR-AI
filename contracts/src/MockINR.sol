// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockINR is ERC20, Ownable {
    address public minter;
    constructor(address relayer) ERC20("Mock INR", "mINR") Ownable(msg.sender) {
        require(relayer != address(0), "Zero minter");
        minter = relayer;
    }
    function setMinter(address next) external onlyOwner {
        require(next != address(0), "Zero minter");
        minter = next;
    }
    function mint(address to, uint256 amount) external {
        require(msg.sender == minter, "Not minter");
        _mint(to, amount);
    }
}
