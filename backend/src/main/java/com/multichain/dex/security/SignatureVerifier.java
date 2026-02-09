package com.multichain.dex.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.web3j.crypto.Keys;
import org.web3j.crypto.Sign;
import org.web3j.utils.Numeric;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;

@Component
@Slf4j
public class SignatureVerifier {

    private static final String PERSONAL_MESSAGE_PREFIX = "\u0019Ethereum Signed Message:\n";

    public boolean verifySignature(String message, String signature, String expectedAddress) {
        try {
            byte[] messageHash = getEthereumMessageHash(message);
            byte[] signatureBytes = Numeric.hexStringToByteArray(signature);

            if (signatureBytes.length != 65) {
                log.warn("Invalid signature length: {}", signatureBytes.length);
                return false;
            }

            byte v = signatureBytes[64];
            if (v < 27) {
                v += 27;
            }

            byte[] r = Arrays.copyOfRange(signatureBytes, 0, 32);
            byte[] s = Arrays.copyOfRange(signatureBytes, 32, 64);

            Sign.SignatureData signatureData = new Sign.SignatureData(v, r, s);

            BigInteger publicKey = Sign.signedPrefixedMessageToKey(
                message.getBytes(StandardCharsets.UTF_8),
                signatureData
            );

            String recoveredAddress = "0x" + Keys.getAddress(publicKey);

            boolean isValid = recoveredAddress.equalsIgnoreCase(expectedAddress);
            log.debug("Signature verification - Expected: {}, Recovered: {}, Valid: {}",
                expectedAddress, recoveredAddress, isValid);

            return isValid;
        } catch (Exception e) {
            log.error("Error verifying signature: {}", e.getMessage(), e);
            return false;
        }
    }

    private byte[] getEthereumMessageHash(String message) throws Exception {
        String prefix = PERSONAL_MESSAGE_PREFIX + message.length();
        String fullMessage = prefix + message;

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(fullMessage.getBytes(StandardCharsets.UTF_8));
    }
}
