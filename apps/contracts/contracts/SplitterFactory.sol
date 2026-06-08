// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Splitter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title SplitterFactory
/// @notice Deploys one Splitter per publisher. Stores updatable fee parameters.
///         Only the owner can change fee parameters — affects all future splits.
contract SplitterFactory is Ownable {
    // ── Fee parameters (all amounts in USDC units, 6 decimals) ────────────────
    // $0.01 = 10_000 | $0.02 = 20_000 | $0.10 = 100_000 | $1.00 = 1_000_000

    uint256 public minAmount      = 20_000;   // $0.02 — minimum accepted payment
    uint256 public flatFee        = 10_000;   // $0.01 — flat fee below threshold
    uint256 public threshold      = 100_000;  // $0.10 — above this: percentage fee
    uint256 public feeBps         = 1000;     // 10%  — in basis points (1000 = 10%)
    uint256 public constant BPS   = 10_000;

    address public immutable platform;
    address public immutable usdc;

    mapping(address => address) public splitters; // publisher → splitter

    event SplitterCreated(address indexed publisher, address splitter);
    event FeeParamsUpdated(uint256 minAmount, uint256 flatFee, uint256 threshold, uint256 feeBps);

    constructor(address _platform, address _usdc) Ownable(msg.sender) {
        platform = _platform;
        usdc     = _usdc;
    }

    /// @notice Update fee parameters. Only callable by owner.
    function setFeeParams(
        uint256 _minAmount,
        uint256 _flatFee,
        uint256 _threshold,
        uint256 _feeBps
    ) external onlyOwner {
        require(_feeBps <= BPS, "fee > 100%");
        minAmount = _minAmount;
        flatFee   = _flatFee;
        threshold = _threshold;
        feeBps    = _feeBps;
        emit FeeParamsUpdated(_minAmount, _flatFee, _threshold, _feeBps);
    }

    /// @notice Calculate platform fee for a given amount using current parameters.
    function calculateFee(uint256 amount) public view returns (uint256) {
        if (amount < minAmount) return 0;
        if (amount < threshold) return flatFee;
        return amount * feeBps / BPS;
    }

    /// @notice Deploy a splitter for a publisher. Idempotent.
    function deploy(address publisher) external returns (address) {
        if (splitters[publisher] != address(0)) return splitters[publisher];
        Splitter s = new Splitter(publisher, platform, usdc, address(this));
        splitters[publisher] = address(s);
        emit SplitterCreated(publisher, address(s));
        return address(s);
    }

    /// @notice Trigger split on multiple splitters in one transaction.
    function splitMany(address[] calldata splitterAddresses) external {
        for (uint256 i = 0; i < splitterAddresses.length; i++) {
            try Splitter(splitterAddresses[i]).split() {} catch {}
        }
    }
}
