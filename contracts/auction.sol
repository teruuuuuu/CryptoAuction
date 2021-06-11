pragma solidity ^0.5.4;

contract Auction {
    string public title;
    string public text;
    uint256 public auctionEndTime;
    address payable public beneficiary;

    address payable public highestBidder;
    uint256 public highestBid;

    mapping(address => uint256) pendingReturns;

    bool end = false;

    event HighestBidIncreased(address bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);

    constructor(
        string memory _title,
        string memory _text,
        uint256 _biddingTime,
        uint256 _startPrice,
        address payable _beneficiary
    ) public {
        title = _title;
        text = _text;
        auctionEndTime = now + _biddingTime * 60;
        beneficiary = _beneficiary;
        highestBid = _startPrice;
    }

    function bid() public payable {
        require(now <= auctionEndTime, "Auction already ended.");
        require(msg.value > highestBid, "There already is a higher bid.");

        if (highestBidder != address(0)) {
            highestBidder.transfer(highestBid);
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
        emit HighestBidIncreased(msg.sender, msg.value);
    }

    function auctionEnd() public {
        require(now >= auctionEndTime, "Auction not yet ended.");
        require(!end, "auctionEnd has already been called.");
        require(
            beneficiary == msg.sender,
            "Only beneficiaries can end the auction."
        );

        end = true;
        emit AuctionEnded(highestBidder, highestBid);

        if (highestBidder != address(0)) {
            beneficiary.transfer(highestBid);
        }
    }

    function getInfo()
        public
        view
        returns (
            string memory,
            string memory,
            uint256,
            address,
            address,
            uint256,
            bool
        )
    {
        return (
            title,
            text,
            auctionEndTime,
            beneficiary,
            highestBidder,
            highestBid,
            end
        );
    }
}
