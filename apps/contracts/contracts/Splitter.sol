// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IFeeCalc {
    function calculateFee(uint256 amount) external view returns (uint256);
    function platform() external view returns (address);
}

/// @title Splitter
/// @notice Receives USDC and splits it between publisher and platform.
///         Fee parameters are read from the Factory — always uses current rates.
///         Anyone can call split().
contract Splitter {
    address public immutable publisher;
    address public immutable factory;
    IERC20  public immutable usdc;

    event Split(address indexed publisher, uint256 publisherAmount, uint256 platformAmount);

    constructor(address _publisher, address _platform, address _usdc, address _factory) {
        require(_publisher != address(0), "invalid publisher");
        publisher = _publisher;
        factory   = _factory;
        usdc      = IERC20(_usdc);
    }

    /// @notice Distribute accumulated USDC using current fee parameters from factory.
    function split() external {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) return;

        IFeeCalc calc = IFeeCalc(factory);
        address  platform = calc.platform();
        uint256  platformAmount  = calc.calculateFee(balance);
        uint256  publisherAmount = balance - platformAmount;

        if (platformAmount  > 0) usdc.transfer(platform,  platformAmount);
        if (publisherAmount > 0) usdc.transfer(publisher, publisherAmount);

        emit Split(publisher, publisherAmount, platformAmount);
    }
}
