#[test_only]
module dex::trade_tests {
    use dex::trade::{Self, TradeRecord};
    use sui::test_scenario as ts;

    const SELLER: address = @0xA11CE;
    const BUYER: address = @0xB0B;

    #[test]
    fun test_record_and_read_trade() {
        let mut scenario = ts::begin(SELLER);
        {
            trade::record_trade(
                42,        // order_id
                SELLER,
                BUYER,
                100,       // sell_amount
                250,       // buy_amount
                1_700_000, // timestamp_ms
                ts::ctx(&mut scenario),
            );
        };

        // The TradeRecord is transferred to the buyer for record keeping.
        ts::next_tx(&mut scenario, BUYER);
        {
            let rec = ts::take_from_sender<TradeRecord>(&scenario);
            let (order_id, seller, buyer, sell_amount, buy_amount, ts_ms) =
                trade::get_trade_info(&rec);
            assert!(order_id == 42, 0);
            assert!(seller == SELLER, 1);
            assert!(buyer == BUYER, 2);
            assert!(sell_amount == 100, 3);
            assert!(buy_amount == 250, 4);
            assert!(ts_ms == 1_700_000, 5);
            ts::return_to_sender(&scenario, rec);
        };
        ts::end(scenario);
    }
}
