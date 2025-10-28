# 1. Get the name of your Kafka pod (if you don't already have it)
KAFKA_POD=$(kubectl get pods -n kafka -l strimzi.io/name=campus-kafka-cluster-kafka -o jsonpath='{.items[0].metadata.name}')

# 2. Execute the consumer command inside the pod
kubectl exec -it $KAFKA_POD -n kafka -- \
  bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic user_events