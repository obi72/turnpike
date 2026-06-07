// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Splitter.sol";

/// @title SplitterFactory
/// @notice Deploys one Splitter per publisher and tracks addresses.
contract SplitterFactory {
    address public immutable platform;
    address public immutable usdc;

    mapping(address => address) public splitters; // publisher → splitter

    event SplitterCreated(address indexed publisher, address splitter);

    constructor(address _platform, address _usdc) {
        platform = _platform;
        usdc     = _usdc;
    }

    /// @notice Deploy a splitter for a publisher. Idempotent — returns existing if already deployed.
    function deploy(address publisher) external returns (address) {
        if (splitters[publisher] != address(0)) {
            return splitters[publisher];
        }
        Splitter s = new Splitter(publisher, platform, usdc);
        splitters[publisher] = address(s);
        emit SplitterCreated(publisher, address(s));
        return address(s);
    }

    /// @notice Trigger split on all provided splitter addresses in one tx (gas efficient).
    function splitMany(address[] calldata splitterAddresses) external {
        for (uint256 i = 0; i < splitterAddresses.length; i++) {
            try Splitter(splitterAddresses[i]).split() {} catch {}
        }
    }
}
