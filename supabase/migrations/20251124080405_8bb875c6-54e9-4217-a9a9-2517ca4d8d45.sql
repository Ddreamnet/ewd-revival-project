-- Create function to batch update order indices for global topics
CREATE OR REPLACE FUNCTION update_global_topics_order(topic_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  topic_order jsonb;
BEGIN
  -- Loop through each topic and update its order_index
  FOR topic_order IN SELECT * FROM jsonb_array_elements(topic_orders)
  LOOP
    UPDATE global_topics
    SET order_index = (topic_order->>'order_index')::integer
    WHERE id = (topic_order->>'id')::uuid;
  END LOOP;
END;
$$;

-- Create function to batch update order indices for global topic resources
CREATE OR REPLACE FUNCTION update_global_resources_order(resource_orders jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resource_order jsonb;
BEGIN
  -- Loop through each resource and update its order_index
  FOR resource_order IN SELECT * FROM jsonb_array_elements(resource_orders)
  LOOP
    UPDATE global_topic_resources
    SET order_index = (resource_order->>'order_index')::integer
    WHERE id = (resource_order->>'id')::uuid;
  END LOOP;
END;
$$;