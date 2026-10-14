// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract FairAI is EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable inr;
    address public relayer;
    uint256 public constant CAP = 1950e18;
    uint256 public immutable withdrawWait;
    mapping(address => uint256) public balance;
    mapping(address => address) public meterKey;
    mapping(address => mapping(uint256 => uint256)) public monthlySpent;
    mapping(bytes32 => bool) public settled;
    mapping(address => uint256) public withdrawRequestedAt;
    uint256 public earnings;
    bytes32 constant RECEIPT_TYPEHASH = keccak256("Receipt(address user,bytes32 sessionId,uint256 amount)");
    error NotRelayer(); error AlreadySettled(); error BadSignature(); error NoKey();
    error ZeroAmount(); error NoRequest(); error WaitNotOver(); error NothingToWithdraw();
    event Deposited(address indexed user, uint256 amount);
    event MeterKeySet(address indexed user, address key);
    event SessionSettled(address indexed user, bytes32 indexed sessionId, uint256 requested, uint256 charged);
    event WithdrawRequested(address indexed user);
    event Withdrawn(address indexed user, uint256 amount);
    event EarningsClaimed(address indexed to, uint256 amount);
    constructor(IERC20 token, address service, uint256 wait) EIP712("FairAI", "1") Ownable(msg.sender) {
        require(address(token) != address(0) && service != address(0), "Zero configuration");
        inr = token; relayer = service; withdrawWait = wait;
    }
    function depositAndSetKey(uint256 amount, address key) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (key == address(0)) revert NoKey();
        inr.safeTransferFrom(msg.sender, address(this), amount);
        balance[msg.sender] += amount;
        if (meterKey[msg.sender] != key) { meterKey[msg.sender] = key; emit MeterKeySet(msg.sender, key); }
        withdrawRequestedAt[msg.sender] = 0;
        emit Deposited(msg.sender, amount);
    }
    function settle(address user, bytes32 sessionId, uint256 amount, bytes calldata sig) external returns (uint256 charge) {
        if (msg.sender != relayer) revert NotRelayer();
        if (settled[sessionId]) revert AlreadySettled();
        if (meterKey[user] == address(0)) revert NoKey();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(RECEIPT_TYPEHASH, user, sessionId, amount)));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, sig);
        if (err != ECDSA.RecoverError.NoError || signer != meterKey[user]) revert BadSignature();
        uint256 m = currentMonth();
        uint256 spent = monthlySpent[user][m];
        uint256 remaining = CAP > spent ? CAP - spent : 0;
        charge = amount < remaining ? amount : remaining;
        if (charge > balance[user]) charge = balance[user];
        settled[sessionId] = true;
        balance[user] -= charge; monthlySpent[user][m] += charge; earnings += charge;
        emit SessionSettled(user, sessionId, amount, charge);
    }
    function requestWithdraw() external {
        if (balance[msg.sender] == 0) revert NothingToWithdraw();
        withdrawRequestedAt[msg.sender] = block.timestamp;
        emit WithdrawRequested(msg.sender);
    }
    function withdraw() external nonReentrant {
        uint256 requested = withdrawRequestedAt[msg.sender];
        if (requested == 0) revert NoRequest();
        if (block.timestamp < requested + withdrawWait) revert WaitNotOver();
        uint256 amount = balance[msg.sender];
        balance[msg.sender] = 0; withdrawRequestedAt[msg.sender] = 0;
        inr.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }
    function claimEarnings(address to) external onlyOwner nonReentrant {
        uint256 amount = earnings; earnings = 0;
        inr.safeTransfer(to, amount); emit EarningsClaimed(to, amount);
    }
    function setRelayer(address next) external onlyOwner { require(next != address(0), "Zero relayer"); relayer = next; }
    function currentMonth() public view returns (uint256) { return block.timestamp / 30 days; }
    function spentThisMonth(address user) external view returns (uint256) { return monthlySpent[user][currentMonth()]; }
    function withdrawReadyAt(address user) external view returns (uint256) {
        uint256 requested = withdrawRequestedAt[user]; return requested == 0 ? 0 : requested + withdrawWait;
    }
}
