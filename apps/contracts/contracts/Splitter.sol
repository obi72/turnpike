// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title Splitter
/// @notice Receives USDC and splits it 85% to publisher, 15% to platform.
///         Anyone can call split() — ratios are hardcoded, nothing can be stolen.
contract Splitter {
    address public immutable publisher;
    address public immutable platform;
    IERC20  public immutable usdc;

    uint256 public constant PLATFORM_BPS  = 1500; // 15%
    uint256 public constant BPS_DENOMINATOR = 10000;

    event Split(address indexed publisher, uint256 publisherAmount, uint256 platformAmount);

    constructor(address _publisher, address _platform, address _usdc) {
        require(_publisher != address(0), "invalid publisher");
        require(_platform  != address(0), "invalid platform");
        publisher = _publisher;
        platform  = _platform;
        usdc      = IERC20(_usdc);
    }

    /// @notice Distribute accumulated USDC. Callable by anyone.
    function split() external {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) return;

        uint256 platformAmount  = balance * PLATFORM_BPS / BPS_DENOMINATOR;
        uint256 publisherAmount = balance - platformAmount;

        if (platformAmount > 0)  usdc.transfer(platform,  platformAmount);
        if (publisherAmount > 0) usdc.transfer(publisher, publisherAmount);

        emit Split(publisher, publisherAmount, platformAmount);
    }
}
