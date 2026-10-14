// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {FairAI} from "../src/FairAI.sol";
import {MockINR} from "../src/MockINR.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface Vm {
    function addr(uint256) external returns(address);
    function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
    function chainId(uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function expectEmit(bool,bool,bool,bool,address) external;
}
contract FairAITest {
    Vm constant vm=Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    FairAI app; MockINR inr; address user; address key; address constant relayer=address(0xBEEF);
    uint256 constant KEY=12345;
    event SessionSettled(address indexed user,bytes32 indexed sessionId,uint256 requested,uint256 charged);
    function setUp() public {
        vm.chainId(10143); vm.warp(60 days+1);
        user=vm.addr(42); key=vm.addr(KEY);
        inr=new MockINR(relayer); app=new FairAI(IERC20(address(inr)),relayer,120);
        vm.prank(relayer); inr.mint(user,10000e18);
        vm.startPrank(user); inr.approve(address(app),type(uint256).max); app.depositAndSetKey(3000e18,key); vm.stopPrank();
    }
    function digest(address who,bytes32 id,uint256 amount) internal view returns(bytes32) {
        bytes32 domain=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256("FairAI"),keccak256("1"),block.chainid,address(app)));
        bytes32 receipt=keccak256(abi.encode(keccak256("Receipt(address user,bytes32 sessionId,uint256 amount)"),who,id,amount));
        return keccak256(abi.encodePacked("\x19\x01",domain,receipt));
    }
    function signature(address who,bytes32 id,uint256 amount,uint256 pk) internal returns(bytes memory) {
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(pk,digest(who,id,amount)); return abi.encodePacked(r,s,v);
    }
    function pay(bytes32 id,uint256 amount) internal returns(uint256) {
        bytes memory sig=signature(user,id,amount,KEY); vm.prank(relayer); return app.settle(user,id,amount,sig);
    }
    function eq(uint256 a,uint256 b) internal pure {require(a==b,"unequal");}
    function testValidReceiptAndEvent() public {
        bytes32 id=bytes32(uint256(1)); bytes memory sig=signature(user,id,25e18,KEY);
        vm.expectEmit(true,true,false,true,address(app)); emit SessionSettled(user,id,25e18,25e18);
        vm.prank(relayer); eq(app.settle(user,id,25e18,sig),25e18);
        eq(app.balance(user),2975e18); eq(app.spentThisMonth(user),25e18); eq(app.earnings(),25e18);
    }
    function testWrongKey() public {
        bytes memory sig=signature(user,bytes32(uint256(1)),1e18,99);
        vm.prank(relayer); vm.expectRevert(FairAI.BadSignature.selector); app.settle(user,bytes32(uint256(1)),1e18,sig);
    }
    function testMalformedSignature() public {
        vm.prank(relayer); vm.expectRevert(FairAI.BadSignature.selector); app.settle(user,bytes32(uint256(1)),1e18,hex"1234");
    }
    function testReplay() public {
        bytes32 id=bytes32(uint256(1)); pay(id,1e18); bytes memory sig=signature(user,id,1e18,KEY);
        vm.prank(relayer); vm.expectRevert(FairAI.AlreadySettled.selector); app.settle(user,id,1e18,sig);
    }
    function testCapAndNewMonth() public {
        eq(pay(bytes32(uint256(1)),1940e18),1940e18); eq(pay(bytes32(uint256(2)),50e18),10e18);
        eq(pay(bytes32(uint256(3)),50e18),0); vm.warp(block.timestamp+30 days); eq(pay(bytes32(uint256(4)),50e18),50e18);
    }
    function testBalanceLimit() public {
        vm.startPrank(user); app.requestWithdraw(); vm.warp(block.timestamp+120); app.withdraw(); app.depositAndSetKey(5e18,key); vm.stopPrank();
        eq(pay(bytes32(uint256(1)),20e18),5e18); eq(app.balance(user),0);
    }
    function testWithdrawWaitAndFullBalance() public {
        vm.prank(user); app.requestWithdraw(); eq(app.withdrawReadyAt(user),block.timestamp+120);
        vm.prank(user); vm.expectRevert(FairAI.WaitNotOver.selector); app.withdraw();
        vm.warp(block.timestamp+120); vm.prank(user); app.withdraw(); eq(app.balance(user),0); eq(inr.balanceOf(user),10000e18); eq(app.withdrawReadyAt(user),0);
    }
    function testNonRelayer() public {
        bytes memory sig=signature(user,bytes32(uint256(1)),1e18,KEY);
        vm.prank(user); vm.expectRevert(FairAI.NotRelayer.selector); app.settle(user,bytes32(uint256(1)),1e18,sig);
    }
    function testDepositCancelsWithdrawal() public {
        vm.startPrank(user); app.requestWithdraw(); app.depositAndSetKey(1e18,key); vm.stopPrank(); eq(app.withdrawRequestedAt(user),0);
    }
    function testSettleDuringWait() public {
        vm.prank(user); app.requestWithdraw(); pay(bytes32(uint256(1)),40e18); vm.warp(block.timestamp+120);
        vm.prank(user); app.withdraw(); eq(inr.balanceOf(user),9960e18);
    }
    function testClaimOwnerOnly() public {
        pay(bytes32(uint256(1)),40e18); vm.prank(user); vm.expectRevert(); app.claimEarnings(user);
        app.claimEarnings(address(this)); eq(app.earnings(),0); eq(inr.balanceOf(address(this)),40e18);
    }
    function testCannotChangeAmountOrUser() public {
        bytes32 id=bytes32(uint256(1)); bytes memory sig=signature(user,id,1e18,KEY);
        vm.prank(relayer); vm.expectRevert(FairAI.BadSignature.selector); app.settle(user,id,2e18,sig);
        address other=vm.addr(77); vm.prank(relayer); inr.mint(other,10e18);
        vm.startPrank(other); inr.approve(address(app),10e18); app.depositAndSetKey(10e18,key); vm.stopPrank();
        vm.prank(relayer); vm.expectRevert(FairAI.BadSignature.selector); app.settle(other,id,1e18,sig);
    }
    function testZeroAndNoRequest() public {
        vm.startPrank(user); vm.expectRevert(FairAI.ZeroAmount.selector); app.depositAndSetKey(0,key);
        vm.expectRevert(FairAI.NoKey.selector); app.depositAndSetKey(1,address(0));
        vm.expectRevert(FairAI.NoRequest.selector); app.withdraw(); vm.stopPrank();
    }
    function testViemFixture() public pure {
        // Generated by scripts/receipt-fixture.ts using viem.hashTypedData.
        bytes32 domain=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256("FairAI"),keccak256("1"),uint256(10143),address(0x1111111111111111111111111111111111111111)));
        bytes32 receipt=keccak256(abi.encode(keccak256("Receipt(address user,bytes32 sessionId,uint256 amount)"),address(0x2222222222222222222222222222222222222222),bytes32(uint256(1)),uint256(123e16)));
        require(keccak256(abi.encodePacked("\x19\x01",domain,receipt))==FIXTURE_HASH,"viem mismatch");
    }
    bytes32 constant FIXTURE_HASH=0xc04dd429c08b52f061ddd66d94069ae50f91e27beeac84f9013f8853988db1e0;
}
