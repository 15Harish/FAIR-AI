// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {MockINR} from "../src/MockINR.sol";
import {FairAI} from "../src/FairAI.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface DeployVm {
    function envUint(string calldata) external returns(uint256);
    function envAddress(string calldata) external returns(address);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}
contract Deploy {
    DeployVm constant vm=DeployVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    event Deployment(address MockINR,address FairAI);
    function run() external returns(MockINR inr,FairAI app) {
        uint256 pk=vm.envUint("DEPLOYER_PRIVATE_KEY"); address service=vm.envAddress("RELAYER_ADDRESS");
        vm.startBroadcast(pk); inr=new MockINR(service); app=new FairAI(IERC20(address(inr)),service,120); vm.stopBroadcast();
        emit Deployment(address(inr),address(app));
    }
}
